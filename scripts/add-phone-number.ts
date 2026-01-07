#!/usr/bin/env npx tsx
import { PrismaClient } from "../apps/api/src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === "--list-orgs") {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "desc" },
    });
    console.log("\nOrganizations:");
    for (const org of orgs) {
      console.log(`  ID: ${org.id}`);
      console.log(`  Name: ${org.name}`);
      console.log(`  Slug: ${org.slug}`);
      console.log("");
    }
    process.exit(0);
  }

  if (args.length < 2) {
    console.log("Usage: npx tsx scripts/add-phone-number.ts <orgId> <e164> [label]");
    console.log("Example: npx tsx scripts/add-phone-number.ts demo-org-123 +15551234567 'Main Line'");
    console.log("\nTo find org IDs, run: npx tsx scripts/add-phone-number.ts --list-orgs");
    process.exit(1);
  }

  const [orgId, e164, label = "Inbound Line"] = args;

  if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
    console.error("Error: Invalid E.164 format. Must start with + followed by 7-15 digits");
    process.exit(1);
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    console.error(`Error: Organization not found: ${orgId}`);
    console.log("\nRun with --list-orgs to see available organizations");
    process.exit(1);
  }

  const existingPhone = await prisma.phoneNumber.findFirst({
    where: { e164 },
  });

  if (existingPhone) {
    console.error(`Error: Phone number ${e164} already registered`);
    console.log(`  Current org: ${existingPhone.orgId}`);
    process.exit(1);
  }

  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      orgId,
      e164,
      label,
      provider: "twilio",
      inboundEnabled: true,
    },
  });

  console.log("\nPhone number created successfully:");
  console.log(`  ID: ${phoneNumber.id}`);
  console.log(`  E164: ${phoneNumber.e164}`);
  console.log(`  Label: ${phoneNumber.label}`);
  console.log(`  Org: ${org.name} (${org.id})`);
  console.log(`  Inbound Enabled: ${phoneNumber.inboundEnabled}`);
  console.log("\nNext steps:");
  console.log("1. In Twilio console, configure this number's webhook:");
  console.log(`   Voice webhook URL: https://counseltech.legal/v1/telephony/twilio/voice (POST)`);
  console.log(`   SMS webhook URL: https://counseltech.legal/v1/telephony/twilio/sms (POST)`);
  console.log("2. Ensure OpenAI Realtime is configured with:");
  console.log("   - OPENAI_API_KEY, OPENAI_PROJECT_ID, OPENAI_WEBHOOK_SECRET");
  console.log("3. Test by calling the number from a real phone");
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
