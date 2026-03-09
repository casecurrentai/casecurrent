import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";

const SECTIONS = [
  {
    title: "1. What We Collect",
    content: "We collect information you voluntarily provide when using our platform or requesting services, including: your name, email address, phone number, and law firm name; messages and communications you send through our platform; call recordings and transcripts generated during AI-assisted intake calls; and technical data such as IP address, browser type, and device information collected automatically when you visit our website."
  },
  {
    title: "2. How We Use Your Data",
    content: "We use the information we collect to: respond to your inquiries and demo requests; provide AI-powered intake, scheduling, and case management services; send case-related updates, appointment reminders, and follow-up communications; improve our platform, train our AI models, and enhance service quality; comply with legal obligations and enforce our Terms of Service."
  },
  {
    title: "SMS Communications & Mobile Information",
    content: "If you provide your mobile phone number and consent to receive text messages, we may send case-related communications including responses to inquiries, intake follow-ups, scheduling updates, and service notifications. Message frequency varies. Message and data rates may apply. You may opt out at any time by replying STOP. For assistance, reply HELP or contact us at support@casecurrent.co. NO mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Information may be shared with subcontractors or service providers solely for the purpose of supporting customer service, technical operations, or message delivery. Text messaging originator opt-in data and consent will not be shared with any third parties except as required by law."
  },
  {
    title: "4. Data Sharing",
    content: "We do not sell or share phone numbers or SMS consent with third parties for their marketing purposes. We may share your information with: law firms you have contacted or been connected with through our platform; service providers who assist us in operating our platform (e.g., cloud hosting, telephony providers, analytics tools), subject to confidentiality obligations; and law enforcement or government agencies when required by applicable law, court order, or legal process."
  },
  {
    title: "5. Security & Retention",
    content: "We implement industry-standard security measures to protect your personal information, including encryption in transit (TLS) and at rest, role-based access controls, and audit logging. We retain your data for as long as necessary to provide our services, comply with legal obligations, and resolve disputes. Call recordings and transcripts are retained according to the data retention policies configured by the law firm you interacted with."
  },
  {
    title: "6. Your Rights",
    content: "You have the right to: request access to the personal data we hold about you; request correction of inaccurate or incomplete data; request deletion of your personal data, subject to legal retention requirements; opt out of marketing communications at any time; and withdraw consent for SMS messaging by replying STOP. To exercise any of these rights, please contact us at privacy@casecurrent.co. We will respond to your request within 30 days."
  },
  {
    title: "7. Cookies & Tracking",
    content: "Our website uses cookies and similar technologies to provide essential functionality, remember your preferences, and analyze site usage. You can control cookie settings through your browser preferences. Disabling certain cookies may affect your experience on our website."
  },
  {
    title: "8. Changes to This Policy",
    content: "We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on our website and updating the \"Last updated\" date. Your continued use of our services after changes take effect constitutes acceptance of the revised policy."
  },
  {
    title: "9. Contact Us",
    content: "If you have questions about this Privacy Policy or our data practices, please contact us at privacy@casecurrent.co, call (504) 900-5237, or write to CaseCurrent, New Orleans, LA."
  },
];

export default function PrivacyPage() {
  return (
    <PageShell
      title="Privacy Policy | CaseCurrent"
      description="CaseCurrent Privacy Policy covering data collection, SMS messaging, data sharing, security, and your rights."
    >
      <Hero
        headline="Privacy Policy"
        subheadline="Last updated: February 17, 2026"
      />

      <SectionBackground variant="subtle">
        <section className="py-16 -mt-10">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Your privacy is important to us. This Privacy Policy explains how
                CaseCurrent collects, uses, and protects your personal information.
                If you have questions, please contact us at{" "}
                <a href="mailto:privacy@casecurrent.co" className="text-primary hover:underline" data-testid="link-privacy-email">
                  privacy@casecurrent.co
                </a>{" "}
                or call us at{" "}
                <a href="tel:+15049005237" className="text-primary hover:underline" data-testid="link-privacy-phone">
                  (504) 900-5237
                </a>.
              </p>

              <div className="space-y-8">
                {SECTIONS.map((section, i) => (
                  <div key={i} data-testid={`section-privacy-${i + 1}`}>
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
                  If you have any questions about this Privacy Policy, please contact us at{" "}
                  <a href="mailto:privacy@casecurrent.co" className="text-primary hover:underline">
                    privacy@casecurrent.co
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
