#!/usr/bin/env npx tsx
import { PrismaClient } from "../apps/api/src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Error: Missing required env var ${name}`);
    process.exit(1);
  }
  return val;
}

const DEFAULT_BUSINESS_HOURS: Record<string, { open: string; close: string } | null> = {
  monday:    { open: "09:00", close: "17:00" },
  tuesday:   { open: "09:00", close: "17:00" },
  wednesday: { open: "09:00", close: "17:00" },
  thursday:  { open: "09:00", close: "17:00" },
  friday:    { open: "09:00", close: "17:00" },
  saturday:  null,
  sunday:    null,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // --- Collect & validate inputs -------------------------------------------

  const databaseUrl = required("DATABASE_URL");
  const orgName = required("ORG_NAME");
  const adminEmail = required("ADMIN_EMAIL");
  const firmPhone = required("FIRM_PHONE_E164");

  const orgTimezone = process.env.ORG_TIMEZONE ?? "America/New_York";
  const adminName =
    process.env.ADMIN_NAME ??
    adminEmail
      .split("@")[0]
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const passwordProvided = !!process.env.ADMIN_PASSWORD;
  const adminPassword =
    process.env.ADMIN_PASSWORD ?? crypto.randomBytes(12).toString("base64url").slice(0, 16);

  const practiceAreaNames = (process.env.DEFAULT_PRACTICE_AREAS ?? "Personal Injury,Criminal Defense,Family Law")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const businessHours: Record<string, { open: string; close: string } | null> =
    process.env.BUSINESS_HOURS ? JSON.parse(process.env.BUSINESS_HOURS) : DEFAULT_BUSINESS_HOURS;

  // Validate E.164
  if (!/^\+[1-9]\d{6,14}$/.test(firmPhone)) {
    console.error(`Error: FIRM_PHONE_E164 "${firmPhone}" is not valid E.164 format (+[country][number])`);
    process.exit(1);
  }

  // Validate password length
  if (adminPassword.length < 8) {
    console.error("Error: ADMIN_PASSWORD must be at least 8 characters");
    process.exit(1);
  }

  // --- Connect Prisma ------------------------------------------------------

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const slug = slugify(orgName);
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // 1. Organization -------------------------------------------------------
    const org = await prisma.organization.upsert({
      where: { slug },
      update: { name: orgName, status: "active", timezone: orgTimezone },
      create: { name: orgName, slug, status: "active", timezone: orgTimezone },
    });

    // 2. Admin user ---------------------------------------------------------
    const user = await prisma.user.upsert({
      where: { orgId_email: { orgId: org.id, email: adminEmail } },
      update: { name: adminName, role: "owner", status: "active", passwordHash },
      create: {
        orgId: org.id,
        email: adminEmail,
        name: adminName,
        role: "owner",
        status: "active",
        passwordHash,
      },
    });

    // 3. Phone number -------------------------------------------------------
    const existingPhone = await prisma.phoneNumber.findUnique({ where: { e164: firmPhone } });
    if (existingPhone && existingPhone.orgId !== org.id) {
      console.error(
        `Error: Phone number ${firmPhone} already belongs to a different organization (${existingPhone.orgId}). Will not reassign.`,
      );
      process.exit(1);
    }

    const phone = await prisma.phoneNumber.upsert({
      where: { e164: firmPhone },
      update: { orgId: org.id, label: "Main Line", provider: "twilio", inboundEnabled: true },
      create: {
        orgId: org.id,
        e164: firmPhone,
        label: "Main Line",
        provider: "twilio",
        inboundEnabled: true,
      },
    });

    // 4. OrgSettings --------------------------------------------------------
    await prisma.orgSettings.upsert({
      where: { orgId: org.id },
      update: { businessHoursJson: businessHours },
      create: { orgId: org.id, businessHoursJson: businessHours },
    });

    // 5. Practice areas -----------------------------------------------------
    const createdAreas: string[] = [];
    for (const name of practiceAreaNames) {
      const paId = `${slugify(name)}-${org.id}`;
      await prisma.practiceArea.upsert({
        where: { id: paId },
        update: { name, active: true },
        create: { id: paId, orgId: org.id, name, active: true },
      });
      createdAreas.push(name);
    }

    // --- Output summary ----------------------------------------------------

    const displayPassword = passwordProvided ? "****" : adminPassword;

    console.log(`
========================================
  Firm Onboarded Successfully
========================================

  Organization ID : ${org.id}
  Organization    : ${org.name} (${slug})
  Admin User ID   : ${user.id}
  Admin Email     : ${user.email}
  Admin Password  : ${displayPassword}
  Phone Number ID : ${phone.id}
  Phone (E.164)   : ${phone.e164}
  Practice Areas  : ${createdAreas.join(", ")}
  OrgSettings     : created/updated
  Business Hours  : Mon-Fri 9:00-17:00 ${orgTimezone}

Next Steps:
  1. Configure Twilio webhook for ${phone.e164}:
     Voice: https://<host>/v1/telephony/twilio/voice (POST)
     SMS:   https://<host>/v1/telephony/twilio/sms (POST)
  2. Log in at the web UI with ${user.email}
  3. Place a test call to ${phone.e164}
`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
