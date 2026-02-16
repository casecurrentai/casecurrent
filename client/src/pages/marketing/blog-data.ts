export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  author: string;
  content: BlogContentBlock[];
}

export type BlogContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "callout"; variant: "tip" | "warning" | "stat" | "info"; title: string; text: string }
  | { type: "quote"; text: string; attribution?: string };

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: "1",
    slug: "ai-transforming-legal-intake",
    title: "5 Ways AI is Transforming Legal Intake",
    excerpt: "Discover how artificial intelligence is revolutionizing the way law firms capture and qualify leads, from 24/7 voice agents to predictive scoring.",
    category: "Industry Trends",
    date: "Jan 3, 2025",
    readTime: "5 min read",
    author: "CaseCurrent Team",
    content: [
      { type: "paragraph", text: "The legal industry is undergoing a fundamental shift in how firms capture and qualify new clients. Artificial intelligence is no longer a futuristic concept for law firms\u2014it's becoming an essential tool for staying competitive in an increasingly digital marketplace." },
      { type: "heading", text: "1. 24/7 AI Voice Agents", level: 2 },
      { type: "paragraph", text: "Traditional intake processes rely on human receptionists available only during business hours. AI voice agents change this entirely by providing intelligent, empathetic responses to potential clients around the clock. These systems can greet callers naturally, ask qualifying questions, and capture critical case information without any human intervention." },
      { type: "callout", variant: "stat", title: "Key Insight", text: "Law firms using AI voice agents report capturing 40% more leads by answering calls outside of business hours when competitors send callers to voicemail." },
      { type: "paragraph", text: "Modern AI voice technology has advanced far beyond robotic-sounding IVR systems. Today's voice agents use natural language processing to understand context, express empathy, and guide conversations organically\u2014creating an experience that callers often can't distinguish from a human receptionist." },
      { type: "heading", text: "2. Predictive Lead Scoring", level: 2 },
      { type: "paragraph", text: "AI-powered scoring systems analyze dozens of factors from each intake interaction to predict case value and conversion likelihood. By examining data points like incident recency, injury severity descriptors, existing medical treatment, and insurance status, these systems can instantly prioritize high-value leads." },
      { type: "list", items: [
        "Incident timing and statute of limitations proximity",
        "Injury severity keywords and medical treatment indicators",
        "Insurance coverage and liability clarity signals",
        "Caller engagement level and responsiveness",
        "Geographic and jurisdictional factors"
      ] },
      { type: "paragraph", text: "This automated scoring eliminates the guesswork from lead prioritization, ensuring your team focuses attention where it matters most." },
      { type: "heading", text: "3. Intelligent Intake Extraction", level: 2 },
      { type: "paragraph", text: "AI systems can automatically extract structured data from unstructured conversations. When a caller describes their situation naturally, the AI identifies and categorizes key information\u2014names, dates, locations, injury details, and insurance information\u2014without requiring the caller to fill out forms or repeat themselves." },
      { type: "callout", variant: "tip", title: "Best Practice", text: "Configure your AI intake to prioritize the most critical qualifying questions first. If a call drops, you'll already have the information needed to follow up effectively." },
      { type: "heading", text: "4. Automated Follow-Up Sequences", level: 2 },
      { type: "paragraph", text: "AI doesn't just capture leads\u2014it nurtures them. Automated follow-up sequences can send personalized SMS messages, schedule callbacks, and trigger notifications based on lead behavior and scoring. This ensures no potential client falls through the cracks during the critical first hours after their initial inquiry." },
      { type: "heading", text: "5. Self-Improving Qualification Logic", level: 2 },
      { type: "paragraph", text: "Perhaps the most powerful aspect of AI intake is its ability to learn and improve over time. Through A/B testing of intake scripts, qualification criteria, and follow-up timing, AI systems continuously optimize their performance based on actual conversion data." },
      { type: "callout", variant: "info", title: "The Bottom Line", text: "Firms that adopt AI-powered intake aren't just automating existing processes\u2014they're fundamentally reimagining how they connect with potential clients. The competitive advantage goes to those who move early." },
      { type: "paragraph", text: "The legal intake landscape is evolving rapidly. Firms that embrace AI-powered tools today are positioning themselves to capture more qualified leads, respond faster to potential clients, and ultimately grow their practice more efficiently than ever before." }
    ]
  },
  {
    id: "2",
    slug: "true-cost-missed-calls-law-firms",
    title: "The True Cost of Missed Calls for Law Firms",
    excerpt: "Research shows that 67% of callers who reach voicemail never call back. Learn the financial impact and how to prevent lost leads.",
    category: "Best Practices",
    date: "Dec 28, 2024",
    readTime: "4 min read",
    author: "CaseCurrent Team",
    content: [
      { type: "paragraph", text: "Every missed call at your law firm represents more than just a missed conversation\u2014it's a potential client who may never call back. In an industry where a single case can be worth tens or even hundreds of thousands of dollars, the financial impact of missed calls is staggering." },
      { type: "callout", variant: "stat", title: "The Hard Truth", text: "67% of callers who reach voicemail will never call back. They'll simply move on to the next firm in their search results." },
      { type: "heading", text: "Calculating Your Missed Call Cost", level: 2 },
      { type: "paragraph", text: "To understand the true impact on your firm, consider this formula: multiply your average case value by your conversion rate, then multiply by the number of calls you miss each month. For a personal injury firm with an average case value of $50,000 and a 15% conversion rate, every missed call represents approximately $7,500 in potential lost revenue." },
      { type: "list", items: [
        "Average PI case value: $50,000",
        "Typical conversion rate: 10-20%",
        "Revenue per missed call: $5,000-$10,000",
        "Monthly missed calls (avg small firm): 30-50",
        "Annual revenue impact: $1.8M-$6M in lost potential"
      ], ordered: false },
      { type: "heading", text: "When Do Missed Calls Happen?", level: 2 },
      { type: "paragraph", text: "Understanding when calls go unanswered is the first step to solving the problem. Data shows that the majority of missed calls occur during three key periods:" },
      { type: "list", items: [
        "Before 8 AM and after 6 PM on weekdays (35% of missed calls)",
        "During lunch hours from 12-1 PM (20% of missed calls)",
        "Weekends and holidays (30% of missed calls)",
        "During staff meetings or court appearances (15% of missed calls)"
      ], ordered: true },
      { type: "callout", variant: "warning", title: "Critical Window", text: "Research from the Lead Response Management Study shows that responding to a lead within 5 minutes makes you 100x more likely to connect and 21x more likely to qualify that lead compared to waiting 30 minutes." },
      { type: "heading", text: "The Ripple Effect", level: 2 },
      { type: "paragraph", text: "Missed calls don't just cost you the immediate potential client. They also impact your reputation through negative reviews from frustrated callers, reduce the effectiveness of your marketing spend, and create a cycle where your cost-per-acquisition steadily increases as you lose leads that your advertising dollars already paid to generate." },
      { type: "heading", text: "Solutions That Work", level: 2 },
      { type: "paragraph", text: "The most effective approach to eliminating missed calls combines technology with process improvement:" },
      { type: "list", items: [
        "Deploy an AI voice agent for 24/7 call answering with intelligent intake",
        "Implement a missed call rescue queue with automated callback scheduling",
        "Set up real-time notifications so your team knows immediately when a high-value lead calls",
        "Track response times and set benchmarks for your team",
        "Use call analytics to identify patterns and staff accordingly"
      ] },
      { type: "callout", variant: "tip", title: "Quick Win", text: "Start by auditing your current missed call rate. Most phone systems can generate a report showing abandoned calls, voicemails, and after-hours call volume. The numbers will likely surprise you." },
      { type: "paragraph", text: "The firms that thrive in today's competitive landscape are the ones that treat every incoming call as the valuable opportunity it is. With modern AI tools, there's no reason any potential client should ever reach a voicemail again." }
    ]
  },
  {
    id: "3",
    slug: "lead-qualification-framework",
    title: "Building a Lead Qualification Framework",
    excerpt: "A step-by-step guide to creating scoring criteria that identify high-value cases while filtering out poor-fit inquiries.",
    category: "How-To",
    date: "Dec 20, 2024",
    readTime: "7 min read",
    author: "CaseCurrent Team",
    content: [
      { type: "paragraph", text: "Not all leads are created equal. A well-designed qualification framework helps your firm focus resources on the cases most likely to convert and deliver strong outcomes, while respectfully redirecting inquiries that aren't a good fit." },
      { type: "heading", text: "Why Qualification Matters", level: 2 },
      { type: "paragraph", text: "Without a structured qualification process, firms often waste significant attorney time on consultations that never convert to signed retainers. A clear framework ensures consistent evaluation, reduces bias, and accelerates the intake process." },
      { type: "callout", variant: "stat", title: "Industry Benchmark", text: "Firms with structured qualification frameworks convert leads at 2-3x the rate of firms using ad-hoc evaluation methods." },
      { type: "heading", text: "Step 1: Define Your Ideal Case Profile", level: 2 },
      { type: "paragraph", text: "Start by analyzing your most successful cases from the past two years. Look for patterns in case type, injury severity, liability clarity, insurance coverage, and geographic location. These patterns form the foundation of your scoring criteria." },
      { type: "list", items: [
        "Review your top 20% of cases by outcome value",
        "Identify common characteristics across these cases",
        "Note which initial intake indicators predicted success",
        "Document red flags that appeared in cases that didn't convert",
        "Consult with your attorneys about their qualification preferences"
      ] },
      { type: "heading", text: "Step 2: Create Scoring Categories", level: 2 },
      { type: "paragraph", text: "Break your qualification criteria into weighted categories. Each category should have clear scoring levels that any intake specialist\u2014or AI system\u2014can consistently apply." },
      { type: "list", items: [
        "Case Type Match (weight: 20%) \u2014 Does this case type align with your practice areas?",
        "Liability Clarity (weight: 25%) \u2014 How clear is fault determination?",
        "Injury Severity (weight: 25%) \u2014 What level of damages are indicated?",
        "Insurance/Collectability (weight: 15%) \u2014 Is there adequate coverage?",
        "Timing & Statute (weight: 10%) \u2014 Is the case within the statute of limitations?",
        "Client Cooperation (weight: 5%) \u2014 Is the caller engaged and responsive?"
      ], ordered: true },
      { type: "heading", text: "Step 3: Establish Score Thresholds", level: 2 },
      { type: "paragraph", text: "Define clear action thresholds for your scoring system. A three-tier approach works well for most firms:" },
      { type: "callout", variant: "tip", title: "Recommended Thresholds", text: "Hot leads (score 80+): Immediate attorney callback within 15 minutes. Warm leads (score 50-79): Same-day follow-up with a paralegal. Cool leads (score below 50): Automated nurture sequence with periodic check-ins." },
      { type: "heading", text: "Step 4: Build Your Question Set", level: 2 },
      { type: "paragraph", text: "Design intake questions that naturally elicit the information needed for scoring. The best qualification questions feel conversational rather than interrogative. Lead with open-ended questions that let the caller tell their story, then follow up with specific qualifying questions." },
      { type: "list", items: [
        "\"Can you tell me what happened?\" \u2014 Opens the conversation naturally",
        "\"When did this incident occur?\" \u2014 Checks statute of limitations",
        "\"Have you sought medical treatment?\" \u2014 Indicates injury severity",
        "\"Was anyone else involved?\" \u2014 Establishes liability picture",
        "\"Do you know if there was insurance involved?\" \u2014 Assesses collectability",
        "\"Have you spoken with any other attorneys?\" \u2014 Gauges urgency and competition"
      ] },
      { type: "heading", text: "Step 5: Test and Refine", level: 2 },
      { type: "paragraph", text: "Your qualification framework should be a living document. Review scoring accuracy quarterly by comparing predicted scores against actual case outcomes. Adjust weights and thresholds based on real data, and use A/B testing to optimize your intake questions." },
      { type: "callout", variant: "info", title: "Continuous Improvement", text: "The best qualification frameworks improve over time. Track which scored factors best predict conversion and case value, then adjust your weights accordingly. AI-powered systems can automate this optimization process." },
      { type: "paragraph", text: "A well-built qualification framework transforms your intake process from reactive to strategic. By systematically evaluating every lead against consistent criteria, you ensure your firm's time and resources are invested where they'll generate the strongest returns." }
    ]
  },
  {
    id: "4",
    slug: "personal-injury-intake-best-practices",
    title: "Personal Injury Intake Best Practices",
    excerpt: "Essential questions to ask during PI intake calls and how to structure your qualification workflow for maximum conversion.",
    category: "Practice Areas",
    date: "Dec 15, 2024",
    readTime: "6 min read",
    author: "CaseCurrent Team",
    content: [
      { type: "paragraph", text: "Personal injury intake requires a delicate balance between gathering essential case information and demonstrating empathy to someone who may be in pain, stressed, or frightened. The firms that master this balance consistently outperform their competitors in both conversion rates and client satisfaction." },
      { type: "heading", text: "The First 30 Seconds Matter Most", level: 2 },
      { type: "paragraph", text: "Research consistently shows that the first impression during a PI intake call determines whether a potential client continues the conversation or hangs up. Your greeting should be warm, professional, and immediately reassuring. Avoid legal jargon and focus on making the caller feel heard." },
      { type: "callout", variant: "tip", title: "Effective Greeting Template", text: "\"Thank you for calling [Firm Name]. My name is [Name], and I'm here to help. I understand you may be going through a difficult time. Can you tell me a little about your situation?\"" },
      { type: "heading", text: "Essential PI Intake Questions", level: 2 },
      { type: "paragraph", text: "Structure your intake around these core information areas, but remember to let the conversation flow naturally rather than reading from a rigid checklist:" },
      { type: "heading", text: "Incident Details", level: 3 },
      { type: "list", items: [
        "What type of accident or incident occurred?",
        "When and where did it happen?",
        "Was a police report filed?",
        "Were there any witnesses?",
        "Who was at fault in your view?"
      ] },
      { type: "heading", text: "Injury & Treatment Information", level: 3 },
      { type: "list", items: [
        "What injuries did you sustain?",
        "Have you received medical treatment?",
        "Are you currently under a doctor's care?",
        "Have you missed work due to your injuries?",
        "Are your injuries affecting your daily activities?"
      ] },
      { type: "heading", text: "Insurance & Legal Status", level: 3 },
      { type: "list", items: [
        "Do you know if the other party has insurance?",
        "Have you been contacted by any insurance company?",
        "Have you given any recorded statements?",
        "Have you spoken with or hired any other attorneys?",
        "Has anyone offered you a settlement?"
      ] },
      { type: "callout", variant: "warning", title: "Common Mistake", text: "Don't ask about injuries too aggressively early in the call. Let the caller share their story first, then follow up with specific medical questions. Pushing too hard too fast makes callers feel like they're being evaluated rather than helped." },
      { type: "heading", text: "Qualifying Without Alienating", level: 2 },
      { type: "paragraph", text: "One of the biggest challenges in PI intake is gathering enough information to qualify the case without making the caller feel like they're being interrogated or judged. The key is framing qualification questions as being in the caller's interest." },
      { type: "quote", text: "The best intake specialists don't interrogate\u2014they listen. Let the caller's story guide your questions, and you'll get better information while building stronger rapport.", attribution: "Legal intake consultant" },
      { type: "heading", text: "Documentation Best Practices", level: 2 },
      { type: "paragraph", text: "Every PI intake should produce a standardized record that captures not just the facts, but also the intake specialist's impressions and any red flags or green flags noted during the conversation." },
      { type: "list", items: [
        "Record the call (with consent) for quality assurance and training",
        "Capture caller's exact language when describing injuries\u2014don't paraphrase",
        "Note emotional state and engagement level as qualification signals",
        "Document timeline clearly: incident date, first treatment date, current status",
        "Flag any urgency factors: approaching statute deadlines, insurance pressure, competing firms"
      ], ordered: true },
      { type: "callout", variant: "info", title: "AI-Powered Documentation", text: "Modern AI intake systems can automatically transcribe calls, extract structured data, and generate intake summaries\u2014freeing your team to focus on building rapport with the caller rather than taking notes." },
      { type: "paragraph", text: "Mastering PI intake is an ongoing process. The firms that invest in training, technology, and continuous improvement of their intake process see measurable improvements in conversion rates, client satisfaction, and ultimately, case outcomes." }
    ]
  },
  {
    id: "5",
    slug: "integrating-intake-clio-mycase",
    title: "Integrating Your Intake with Clio and MyCase",
    excerpt: "Technical guide to connecting CaseCurrent with popular legal practice management software for seamless data flow.",
    category: "Integrations",
    date: "Dec 10, 2024",
    readTime: "8 min read",
    author: "CaseCurrent Team",
    content: [
      { type: "paragraph", text: "A seamless connection between your intake system and practice management software eliminates double data entry, reduces errors, and ensures your team can act on new leads immediately. This guide covers how to integrate CaseCurrent with the most popular legal practice management platforms." },
      { type: "heading", text: "Why Integration Matters", level: 2 },
      { type: "paragraph", text: "Without proper integration, intake data lives in one system while your case management lives in another. This creates delays, data entry errors, and missed follow-ups. A well-designed integration ensures that when a qualified lead comes through your intake system, the relevant information flows automatically into your practice management platform." },
      { type: "callout", variant: "stat", title: "Efficiency Gain", text: "Firms with integrated intake-to-PMS workflows reduce lead-to-contact time by 73% and eliminate an average of 15 minutes of manual data entry per lead." },
      { type: "heading", text: "Clio Integration", level: 2 },
      { type: "paragraph", text: "Clio is the most widely used cloud-based legal practice management platform. CaseCurrent integrates with Clio through its REST API to automatically create contacts, matters, and tasks when new qualified leads are captured." },
      { type: "heading", text: "What Gets Synced to Clio", level: 3 },
      { type: "list", items: [
        "Contact information (name, phone, email, address)",
        "Matter creation with practice area classification",
        "Intake notes and call transcription summaries",
        "Custom field mapping for case-specific data",
        "Task creation for follow-up actions",
        "Document attachments (intake forms, signed agreements)"
      ] },
      { type: "heading", text: "Setting Up the Clio Connection", level: 3 },
      { type: "list", items: [
        "Navigate to Settings > Integrations in your CaseCurrent dashboard",
        "Select Clio from the available integrations",
        "Authenticate with your Clio account credentials",
        "Configure field mapping between CaseCurrent intake fields and Clio custom fields",
        "Set up automation rules for when new matters should be created",
        "Test the integration with a sample lead"
      ], ordered: true },
      { type: "heading", text: "MyCase Integration", level: 2 },
      { type: "paragraph", text: "MyCase offers a comprehensive platform popular with small to mid-size firms. CaseCurrent connects to MyCase to provide a seamless intake-to-case-management workflow." },
      { type: "heading", text: "What Gets Synced to MyCase", level: 3 },
      { type: "list", items: [
        "Lead and contact creation with full intake data",
        "Case creation with automatic practice area tagging",
        "Intake call recordings and transcription links",
        "Lead qualification scores and reasoning",
        "Automated task assignment based on lead priority",
        "Status updates and timeline tracking"
      ] },
      { type: "callout", variant: "tip", title: "Pro Tip", text: "Configure your integration to only push qualified leads (score 50+) to your practice management system. This keeps your case management clean and prevents your team from being overwhelmed with unqualified inquiries." },
      { type: "heading", text: "Webhook-Based Integrations", level: 2 },
      { type: "paragraph", text: "For firms using other practice management platforms or custom systems, CaseCurrent offers a powerful webhook system that can push intake data to any endpoint. Webhooks fire in real-time on events like lead creation, intake completion, and qualification scoring." },
      { type: "list", items: [
        "lead.created \u2014 Fires when a new lead is captured from any source",
        "lead.updated \u2014 Fires when lead data is modified or enriched",
        "intake.completed \u2014 Fires when all intake questions have been answered",
        "lead.qualified \u2014 Fires when AI scoring is complete",
        "lead.assigned \u2014 Fires when a lead is assigned to a team member"
      ] },
      { type: "callout", variant: "info", title: "Security Note", text: "All webhook payloads are signed with HMAC-SHA256 using your unique webhook secret. Always verify signatures in your receiving endpoint to ensure data authenticity." },
      { type: "heading", text: "Best Practices for Integration", level: 2 },
      { type: "list", items: [
        "Start with a one-way sync (intake to PMS) before enabling bidirectional data flow",
        "Map your fields carefully\u2014incorrect mapping creates more problems than manual entry",
        "Test thoroughly with sample data before going live",
        "Monitor the integration for the first week to catch any sync failures",
        "Set up alerting for failed webhook deliveries or API errors",
        "Review and update field mappings quarterly as your intake process evolves"
      ] },
      { type: "paragraph", text: "A well-configured integration between your intake system and practice management software is one of the highest-ROI improvements you can make to your firm's operations. The time saved on data entry alone typically pays for itself within the first month." }
    ]
  },
  {
    id: "6",
    slug: "measuring-intake-roi-key-metrics",
    title: "Measuring Intake ROI: Key Metrics to Track",
    excerpt: "The essential KPIs every law firm should monitor to understand intake performance and optimize for growth.",
    category: "Analytics",
    date: "Dec 5, 2024",
    readTime: "5 min read",
    author: "CaseCurrent Team",
    content: [
      { type: "paragraph", text: "You can't improve what you don't measure. For law firms investing in intake technology, understanding which metrics matter\u2014and how to interpret them\u2014is the difference between growing strategically and flying blind." },
      { type: "heading", text: "The Intake Funnel: Your North Star", level: 2 },
      { type: "paragraph", text: "Think of your intake process as a funnel. Every stage represents a conversion point where potential clients either move forward or drop off. Tracking conversion rates at each stage reveals exactly where your process needs attention." },
      { type: "list", items: [
        "Inbound Contact \u2192 Answered/Captured (Target: 95%+)",
        "Answered \u2192 Intake Started (Target: 80%+)",
        "Intake Started \u2192 Intake Completed (Target: 70%+)",
        "Intake Completed \u2192 Qualified Lead (Target: 40-60%)",
        "Qualified Lead \u2192 Consultation Scheduled (Target: 60%+)",
        "Consultation \u2192 Retainer Signed (Target: 30-50%)"
      ], ordered: true },
      { type: "callout", variant: "stat", title: "Industry Benchmark", text: "Top-performing PI firms achieve an overall inbound-to-signed conversion rate of 8-15%. If your rate is below 5%, there are significant optimization opportunities in your funnel." },
      { type: "heading", text: "Speed-to-Response Metrics", level: 2 },
      { type: "paragraph", text: "Response speed is one of the most impactful factors in lead conversion. Track these time-based metrics closely:" },
      { type: "list", items: [
        "Median response time: Time from first contact to human follow-up",
        "P90 response time: Your slowest 10% of responses (this reveals systemic issues)",
        "Within-5-minute rate: Percentage of leads contacted within 5 minutes",
        "Within-15-minute rate: Percentage contacted within 15 minutes",
        "After-hours response time: How quickly you respond to evening/weekend leads"
      ] },
      { type: "callout", variant: "warning", title: "Speed Matters More Than You Think", text: "The odds of qualifying a lead decrease by 10x after the first 5 minutes. After 30 minutes, most leads have already contacted a competitor." },
      { type: "heading", text: "Source Attribution & ROI", level: 2 },
      { type: "paragraph", text: "Understanding which marketing channels deliver the best return on investment helps you allocate your budget effectively. Track these metrics by source:" },
      { type: "list", items: [
        "Cost per lead by channel (Google Ads, LSA, organic, referral, etc.)",
        "Conversion rate by source\u2014some channels produce higher-quality leads",
        "Average case value by source\u2014referrals often produce larger cases",
        "Time-to-conversion by source\u2014some channels have longer sales cycles",
        "Lifetime value by channel\u2014factor in repeat business and referrals"
      ] },
      { type: "heading", text: "Intake Completeness", level: 2 },
      { type: "paragraph", text: "How much information does your intake process actually capture? Incomplete intakes lead to wasted follow-up time and lower conversion rates. Track the capture rate for each critical field:" },
      { type: "list", items: [
        "Caller name: Target 95%+ capture rate",
        "Phone number: Target 98%+ (should be automatic from caller ID)",
        "Incident date: Target 85%+ (critical for statute evaluation)",
        "Injury description: Target 80%+ (key qualification factor)",
        "Insurance information: Target 60%+ (often requires follow-up)",
        "Medical treatment status: Target 75%+"
      ] },
      { type: "callout", variant: "tip", title: "Identify Your Drop-Off Point", text: "Look at which intake field has the steepest drop in capture rate. That's likely where callers are hanging up or your intake process needs improvement. For most firms, this happens around the 3-4 minute mark of the call." },
      { type: "heading", text: "Building Your Dashboard", level: 2 },
      { type: "paragraph", text: "The most effective intake dashboards combine these metrics into a single view that your team reviews daily. Key elements include:" },
      { type: "list", items: [
        "Real-time funnel visualization showing today's conversion rates",
        "Speed metrics with trend lines comparing to your benchmarks",
        "Missed call rescue queue highlighting leads needing immediate callback",
        "Source ROI breakdown updated weekly with cost and conversion data",
        "Intake completeness heatmap showing which fields are captured most often"
      ], ordered: true },
      { type: "callout", variant: "info", title: "Start Simple", text: "Don't try to track everything at once. Start with three metrics: answer rate, response time, and conversion rate. Once you've established baselines and improvement rhythms for these, layer in additional metrics." },
      { type: "paragraph", text: "Consistent measurement transforms intake from an art into a science. By tracking the right metrics, identifying trends, and making data-driven adjustments, your firm can systematically improve its conversion rates and maximize the return on every marketing dollar spent." }
    ]
  }
];

export const CATEGORY_COLORS: Record<string, string> = {
  "Industry Trends": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Best Practices": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "How-To": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Practice Areas": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Integrations": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Analytics": "bg-rose-100 text-rose-700 dark:bg-rose-100/30 dark:text-rose-400",
};
