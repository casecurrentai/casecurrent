import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: "By accessing or using the CaseCurrent platform (\"Service\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree to these Terms, you may not access or use the Service. These Terms apply to all users, including law firm administrators, staff members, and any other authorized personnel."
  },
  {
    title: "2. Description of Service",
    content: "CaseCurrent provides an AI-powered legal intake and lead management platform designed for law firms. The Service includes automated call answering via AI voice agents, lead capture and qualification scoring, structured intake workflows, analytics dashboards, webhook integrations, and related features. The Service is intended to supplement\u2014not replace\u2014the professional judgment of licensed attorneys."
  },
  {
    title: "3. Account Registration",
    content: "To use the Service, you must create an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify CaseCurrent immediately of any unauthorized use of your account. Organizations must designate at least one account owner who has authority to bind the organization to these Terms."
  },
  {
    title: "4. Authorized Users & Access Control",
    content: "Account owners may invite additional users to their organization's account. Each user must have their own credentials. Account owners are responsible for managing user access, including promptly removing access for users who are no longer authorized. CaseCurrent supports role-based access control with distinct permissions for owners, administrators, and staff members."
  },
  {
    title: "5. AI Disclaimer",
    content: "The Service uses artificial intelligence technologies including natural language processing, voice synthesis, automated scoring, and machine learning. AI-generated outputs\u2014including lead qualification scores, intake summaries, call transcriptions, and follow-up recommendations\u2014are provided as decision-support tools only. They do not constitute legal advice, medical advice, or professional recommendations. Licensed attorneys must exercise independent professional judgment on all case evaluation and client acceptance decisions. CaseCurrent makes no warranty regarding the accuracy, completeness, or reliability of AI-generated content."
  },
  {
    title: "6. Data Ownership & Portability",
    content: "You retain full ownership of all data you input into or generate through the Service, including lead information, intake data, call recordings, transcriptions, notes, and case details (\"Customer Data\"). CaseCurrent does not claim ownership of Customer Data. Upon termination of your account, you may request an export of your Customer Data in a standard machine-readable format. CaseCurrent will make such data available for download for 30 days following account termination."
  },
  {
    title: "7. Call Recording Consent",
    content: "The Service may record telephone calls for quality assurance, training, and intake documentation purposes. You are solely responsible for compliance with all applicable federal, state, and local laws regarding call recording and consent, including but not limited to two-party consent jurisdictions. You must configure appropriate call recording disclosures and obtain any required consent before recording calls through the Service. CaseCurrent provides tools to facilitate recording disclosures but does not guarantee legal compliance\u2014this is your responsibility."
  },
  {
    title: "8. TCPA Compliance",
    content: "You agree to comply with the Telephone Consumer Protection Act (TCPA), CAN-SPAM Act, and all applicable federal and state telecommunications regulations when using the Service's calling, SMS, and automated communication features. You are responsible for maintaining proper consent records, honoring do-not-call requests, and ensuring that all outbound communications comply with applicable law. The Service includes DNC (Do Not Call) enforcement features, but ultimate compliance responsibility rests with you."
  },
  {
    title: "9. Acceptable Use",
    content: "You agree not to use the Service to: (a) violate any applicable law or regulation; (b) transmit spam, unsolicited communications, or marketing materials without proper consent; (c) impersonate any person or entity; (d) interfere with or disrupt the Service or its infrastructure; (e) attempt to gain unauthorized access to any portion of the Service; (f) use the Service for any purpose other than legitimate legal intake and lead management; (g) share account credentials with unauthorized parties; or (h) circumvent any security or access control measures."
  },
  {
    title: "10. Privacy & Data Protection",
    content: "CaseCurrent processes Customer Data in accordance with our Privacy Policy, which is incorporated into these Terms by reference. We implement industry-standard security measures to protect Customer Data, including encryption in transit and at rest, access controls, audit logging, and regular security assessments. You acknowledge that no method of electronic storage is 100% secure, and CaseCurrent cannot guarantee absolute security."
  },
  {
    title: "11. Confidentiality",
    content: "CaseCurrent acknowledges that Customer Data may include information protected by attorney-client privilege, work product doctrine, or other legal protections. CaseCurrent will treat all Customer Data as confidential and will not access, use, or disclose Customer Data except as necessary to provide the Service, comply with law, or as expressly authorized by you. CaseCurrent personnel who access Customer Data are bound by confidentiality obligations."
  },
  {
    title: "12. Service Availability",
    content: "CaseCurrent strives to maintain high availability of the Service but does not guarantee uninterrupted access. The Service may be temporarily unavailable due to scheduled maintenance, system updates, or circumstances beyond our reasonable control. We will provide reasonable advance notice of planned maintenance when feasible. CaseCurrent is not liable for any damages resulting from Service unavailability."
  },
  {
    title: "13. Fees & Payment",
    content: "Fees for the Service are set forth in your subscription agreement or the pricing page on our website. All fees are due in advance and are non-refundable except as expressly stated. CaseCurrent reserves the right to modify pricing with 30 days' prior written notice. Continued use of the Service after a price change constitutes acceptance of the new pricing. Failure to pay may result in suspension or termination of access."
  },
  {
    title: "14. Intellectual Property",
    content: "The Service, including its software, design, documentation, and all related intellectual property, is owned by CaseCurrent and protected by applicable intellectual property laws. These Terms grant you a limited, non-exclusive, non-transferable license to use the Service during your subscription period. You may not copy, modify, distribute, reverse engineer, or create derivative works based on the Service."
  },
  {
    title: "15. Third-Party Integrations",
    content: "The Service may integrate with third-party services such as practice management software, telephony providers, and analytics platforms. Your use of third-party services is subject to their respective terms and privacy policies. CaseCurrent is not responsible for the availability, accuracy, or security of third-party services. Integration functionality may change if third-party APIs are modified or discontinued."
  },
  {
    title: "16. Indemnification",
    content: "You agree to indemnify and hold harmless CaseCurrent, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorney fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law, including call recording, TCPA, and data protection laws; or (d) any dispute between you and your clients or potential clients."
  },
  {
    title: "17. Limitation of Liability",
    content: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, CASECURRENT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. CASECURRENT'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY YOU FOR THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM."
  },
  {
    title: "18. Termination",
    content: "Either party may terminate these Terms at any time with 30 days' written notice. CaseCurrent may suspend or terminate your access immediately if you violate these Terms or if required by law. Upon termination, your right to use the Service ceases immediately. Sections regarding data ownership, intellectual property, indemnification, limitation of liability, and governing law survive termination."
  },
  {
    title: "19. Modifications to Terms",
    content: "CaseCurrent may modify these Terms at any time by posting updated Terms on our website and notifying you via email or in-app notification. Changes take effect 30 days after posting unless a shorter period is required by law. Your continued use of the Service after changes take effect constitutes acceptance of the modified Terms. If you do not agree to the changes, you must stop using the Service."
  },
  {
    title: "20. Governing Law & Dispute Resolution",
    content: "These Terms are governed by the laws of the State of Delaware, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved through binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules, conducted in Delaware. Either party may seek injunctive relief in any court of competent jurisdiction to protect its intellectual property rights."
  },
  {
    title: "21. General Provisions",
    content: "These Terms constitute the entire agreement between you and CaseCurrent regarding the Service and supersede all prior agreements. If any provision is found unenforceable, the remaining provisions remain in effect. CaseCurrent's failure to enforce any right or provision does not constitute a waiver. You may not assign these Terms without CaseCurrent's prior written consent. CaseCurrent may assign these Terms in connection with a merger, acquisition, or sale of assets."
  },
];

export default function TermsPage() {
  return (
    <PageShell
      title="Terms of Service | CaseCurrent"
      description="CaseCurrent Terms of Service covering AI disclaimers, data ownership, call recording consent, TCPA compliance, and more."
    >
      <Hero
        headline="Terms of Service"
        subheadline="Last updated: January 1, 2025"
      />

      <SectionBackground variant="subtle">
        <section className="py-16 -mt-10">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Please read these Terms of Service carefully before using CaseCurrent.
                By using our platform, you agree to be bound by these terms. If you have
                questions, please contact us at{" "}
                <a href="mailto:legal@casecurrent.co" className="text-primary hover:underline" data-testid="link-terms-legal-email">
                  legal@casecurrent.co
                </a>{" "}
                or call us at{" "}
                <a href="tel:+15049005237" className="text-primary hover:underline" data-testid="link-terms-phone">
                  (504) 900-5237
                </a>.
              </p>

              <div className="space-y-8">
                {SECTIONS.map((section, i) => (
                  <div key={i} data-testid={`section-terms-${i + 1}`}>
                    <h2 className="text-lg font-semibold text-foreground mb-3">
                      {section.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border mt-12 pt-8">
                <p className="text-sm text-muted-foreground text-center">
                  If you have any questions about these Terms, please contact us at{" "}
                  <a href="mailto:legal@casecurrent.co" className="text-primary hover:underline">
                    legal@casecurrent.co
                  </a>{" "}
                  or{" "}
                  <a href="tel:+15049005237" className="text-primary hover:underline">
                    (504) 900-5237
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </section>
      </SectionBackground>
    </PageShell>
  );
}
