/**
 * Demo Data Script for CounselTech
 * 
 * Run with: npx tsx scripts/demo-data.ts
 * 
 * Creates realistic demo data for UI demonstration:
 * - Multiple contacts with varied information
 * - Leads at different stages with interactions
 * - Intakes at various completion states
 * - Qualifications with different dispositions
 * - Experiments with assignments
 * - Policy test suites and runs
 * - Follow-up sequences
 * - Webhook endpoints
 */

const BASE_URL = process.env.API_URL || "http://localhost:5000";

// Demo user credentials (use existing demo org)
const DEMO_EMAIL = "owner@demo.com";
const DEMO_PASSWORD = "DemoPass123!";

async function api(path: string, options: RequestInit = {}, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

async function createDemoData() {
  console.log("\n========================================");
  console.log("CounselTech Demo Data Generator");
  console.log(`Target: ${BASE_URL}`);
  console.log("========================================\n");

  // Login with demo user
  console.log("Logging in with demo account...");
  const loginRes = await api("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });

  if (!loginRes.ok) {
    console.error("Failed to login. Make sure the demo org exists (run seed script first).");
    process.exit(1);
  }

  const { token, organization } = await loginRes.json();
  console.log(`Logged in to: ${organization.name}\n`);

  // Create contacts
  console.log("Creating demo contacts...");
  const contacts = [
    { name: "Sarah Mitchell", primaryPhone: "+15551234001", primaryEmail: "sarah.mitchell@example.com" },
    { name: "Michael Chen", primaryPhone: "+15551234002", primaryEmail: "michael.chen@example.com" },
    { name: "Jennifer Rodriguez", primaryPhone: "+15551234003", primaryEmail: "jennifer.r@example.com" },
    { name: "David Thompson", primaryPhone: "+15551234004", primaryEmail: "david.thompson@example.com" },
    { name: "Emily Watson", primaryPhone: "+15551234005", primaryEmail: "emily.w@example.com" },
    { name: "Robert Garcia", primaryPhone: "+15551234006", primaryEmail: "robert.g@example.com" },
    { name: "Amanda Foster", primaryPhone: "+15551234007", primaryEmail: "amanda.foster@example.com" },
    { name: "James Wilson", primaryPhone: "+15551234008", primaryEmail: "james.wilson@example.com" },
  ];

  const contactIds: string[] = [];
  for (const contact of contacts) {
    try {
      const res = await api("/v1/contacts", { method: "POST", body: JSON.stringify(contact) }, token);
      if (res.ok) {
        const data = await res.json();
        contactIds.push(data.id);
        console.log(`  Created contact: ${contact.name}`);
      }
    } catch {
      console.log(`  Skipped contact: ${contact.name} (may already exist)`);
    }
  }

  // Create leads with different statuses
  console.log("\nCreating demo leads...");
  const leadData = [
    { status: "new", priority: "high", source: "phone", summary: "Rear-end collision on I-95, possible whiplash injury" },
    { status: "contacted", priority: "medium", source: "web_form", summary: "Slip and fall at grocery store, broken arm" },
    { status: "qualified", priority: "urgent", source: "referral", summary: "Medical malpractice case, surgical error" },
    { status: "new", priority: "low", source: "sms", summary: "Minor fender bender, no apparent injuries" },
    { status: "contacted", priority: "high", source: "phone", summary: "Workplace injury, construction site fall" },
    { status: "new", priority: "medium", source: "web_form", summary: "Product liability, defective appliance" },
    { status: "unqualified", priority: "low", source: "phone", summary: "Inquiry about small claims court" },
    { status: "converted", priority: "urgent", source: "referral", summary: "Serious car accident, multiple injuries" },
  ];

  const leadIds: string[] = [];
  for (let i = 0; i < leadData.length && i < contactIds.length; i++) {
    const lead = leadData[i];
    try {
      const res = await api("/v1/leads", {
        method: "POST",
        body: JSON.stringify({
          contactId: contactIds[i],
          ...lead,
        }),
      }, token);
      if (res.ok) {
        const data = await res.json();
        leadIds.push(data.id);
        console.log(`  Created lead: ${lead.summary.slice(0, 40)}...`);
      }
    } catch {
      console.log(`  Skipped lead creation`);
    }
  }

  // Initialize and complete some intakes
  console.log("\nInitializing intakes...");
  for (let i = 0; i < Math.min(5, leadIds.length); i++) {
    try {
      await api(`/v1/leads/${leadIds[i]}/intake/init`, { method: "POST" }, token);
      
      // Add some answers
      await api(`/v1/leads/${leadIds[i]}/intake`, {
        method: "PATCH",
        body: JSON.stringify({
          answers: {
            incidentDate: `2024-0${i + 1}-${10 + i}`,
            incidentLocation: ["Highway 101", "Main Street", "Downtown Plaza", "Industrial Park", "Retail Mall"][i],
            injuries: ["Whiplash", "Broken arm", "Surgical complications", "Minor bruises", "Back injury"][i],
          },
        }),
      }, token);
      console.log(`  Initialized intake for lead ${i + 1}`);

      // Complete some intakes
      if (i < 3) {
        await api(`/v1/leads/${leadIds[i]}/intake/complete`, { method: "POST" }, token);
        console.log(`  Completed intake for lead ${i + 1}`);
      }
    } catch {
      console.log(`  Skipped intake for lead ${i + 1}`);
    }
  }

  // Run qualification on some leads
  console.log("\nRunning qualifications...");
  for (let i = 0; i < Math.min(4, leadIds.length); i++) {
    try {
      const res = await api(`/v1/leads/${leadIds[i]}/qualification/run`, { method: "POST" }, token);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Qualified lead ${i + 1}: ${data.disposition} (score: ${data.score})`);
      }
    } catch {
      console.log(`  Skipped qualification for lead ${i + 1}`);
    }
  }

  // Create webhook endpoint
  console.log("\nCreating webhook endpoint...");
  try {
    const res = await api("/v1/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://httpbin.org/post",
        events: ["lead.created", "lead.qualified", "intake.completed"],
      }),
    }, token);
    if (res.ok) {
      console.log("  Created webhook endpoint");
    }
  } catch {
    console.log("  Skipped webhook creation");
  }

  // Create experiment
  console.log("\nCreating experiment...");
  try {
    const expRes = await api("/v1/experiments", {
      method: "POST",
      body: JSON.stringify({
        name: "Q1 Intake Script Optimization",
        description: "Testing empathetic vs professional tone in initial intake calls",
        kind: "intake_script",
        config: { variants: ["control", "empathetic_tone", "professional_tone"] },
      }),
    }, token);
    if (expRes.ok) {
      const exp = await expRes.json();
      console.log("  Created experiment: Q1 Intake Script Optimization");
      
      // Start the experiment
      await api(`/v1/experiments/${exp.id}/start`, { method: "POST" }, token);
      console.log("  Started experiment");
      
      // Assign some leads
      for (let i = 0; i < Math.min(4, leadIds.length); i++) {
        await api(`/v1/experiments/${exp.id}/assign`, {
          method: "POST",
          body: JSON.stringify({ leadId: leadIds[i] }),
        }, token);
      }
      console.log("  Assigned leads to experiment");
    }
  } catch {
    console.log("  Skipped experiment creation");
  }

  // Create another experiment in draft
  try {
    await api("/v1/experiments", {
      method: "POST",
      body: JSON.stringify({
        name: "Follow-up Timing Test",
        description: "Testing optimal timing for follow-up messages",
        kind: "follow_up_timing",
        config: { variants: ["control", "aggressive", "passive"] },
      }),
    }, token);
    console.log("  Created draft experiment: Follow-up Timing Test");
  } catch {
    // ignore
  }

  // Create policy test suite with test cases
  console.log("\nCreating policy test suite...");
  try {
    const suiteRes = await api("/v1/policy-tests/suites", {
      method: "POST",
      body: JSON.stringify({
        name: "Core Qualification Logic Tests",
        description: "Validates the qualification scoring engine",
        testCases: [
          { id: "high-score", name: "Complete lead should accept", input: { contact: { phone: "+15551234567", email: "test@test.com" }, practiceArea: true, intake: { complete: true, answers: { incidentDate: "2024-01-15", incidentLocation: "Highway 101" } }, calls: 2 }, expectedDisposition: "accept", expectedMinScore: 70 },
          { id: "low-score", name: "Empty lead should decline", input: { contact: {}, practiceArea: false, intake: { complete: false }, calls: 0 }, expectedDisposition: "decline" },
          { id: "mid-score", name: "Partial info should review", input: { contact: { phone: "+15551234567" }, practiceArea: true, intake: { complete: false, answers: {} }, calls: 1 }, expectedDisposition: "review" },
        ],
      }),
    }, token);
    if (suiteRes.ok) {
      const suite = await suiteRes.json();
      console.log("  Created policy test suite");
      
      // Run the tests
      const runRes = await api(`/v1/policy-tests/suites/${suite.id}/run`, { method: "POST" }, token);
      if (runRes.ok) {
        const run = await runRes.json();
        console.log(`  Ran tests: ${run.summary.passedCount}/${run.summary.totalCount} passed`);
      }
    }
  } catch {
    console.log("  Skipped policy test creation");
  }

  // Create follow-up sequence
  console.log("\nCreating follow-up sequence...");
  try {
    await api("/v1/followup-sequences", {
      method: "POST",
      body: JSON.stringify({
        name: "Aggressive Lead Nurture",
        description: "Fast follow-up sequence for high-priority leads",
        trigger: "lead_created",
        steps: [
          { delayMinutes: 0, channel: "sms", templateBody: "Thank you for reaching out to Demo Law Firm. We have received your inquiry and will contact you shortly." },
          { delayMinutes: 30, channel: "sms", templateBody: "Our team is reviewing your case. Is there any additional information you can provide about your situation?" },
          { delayMinutes: 120, channel: "sms", templateBody: "Hi! Just following up. Our attorneys are standing by to help you. Please call us at your earliest convenience." },
        ],
        stopRules: { onResponse: true, onStatusChange: ["disqualified", "closed", "converted"] },
      }),
    }, token);
    console.log("  Created follow-up sequence: Aggressive Lead Nurture");
  } catch {
    console.log("  Skipped follow-up sequence creation");
  }

  console.log("\n========================================");
  console.log("Demo Data Generation Complete");
  console.log("========================================");
  console.log("\nYou can now explore the app with realistic data.");
  console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("\n");
}

createDemoData().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
