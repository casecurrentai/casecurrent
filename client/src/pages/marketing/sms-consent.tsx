import { useState } from "react";
import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { Link } from "wouter";

export default function SmsConsentPage() {
  const [checked, setChecked] = useState(false);

  return (
    <PageShell
      title="SMS Consent | CaseCurrent"
      description="CaseCurrent SMS consent form. Consent to receive case-related text messages."
    >
      <Hero
        headline="SMS Consent"
        subheadline="How CaseCurrent obtains consent to send text messages"
      />

      <SectionBackground variant="subtle">
        <section className="py-16 -mt-10">
          <div className="container mx-auto px-6">
            <div className="max-w-xl mx-auto space-y-8">

              <div className="rounded-xl border border-border bg-card p-6 space-y-4" data-testid="sms-consent-form">
                <h2 className="text-lg font-semibold text-foreground">
                  Consent to Receive Text Messages
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  CaseCurrent may send case-related SMS communications only to individuals
                  who have voluntarily provided their mobile number and affirmatively
                  checked the consent box below.
                </p>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border" data-testid="sms-consent-checkbox-block">
                  <input
                    type="checkbox"
                    id="smsConsentExample"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    data-testid="checkbox-sms-consent-example"
                    aria-describedby="sms-consent-description"
                  />
                  <div>
                    <label
                      htmlFor="smsConsentExample"
                      className="text-sm font-medium leading-snug cursor-pointer text-foreground"
                      id="sms-consent-description"
                    >
                      I agree to receive case-related text messages. Message frequency
                      varies. Message and data rates may apply. Reply STOP to opt out.
                      Reply HELP for help.
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                      Consent is not a condition of representation.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground" data-testid="sms-consent-opt-out-note">
                  To opt out at any time, reply <strong>STOP</strong>. For help, reply{" "}
                  <strong>HELP</strong>.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 space-y-3" data-testid="sms-consent-details">
                <h3 className="text-base font-semibold text-foreground">
                  How We Use Your Number
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2 leading-relaxed list-disc list-inside">
                  <li>Messages are sent only in response to user-initiated inquiries.</li>
                  <li>Types of messages: intake follow-ups, scheduling updates, case status notifications.</li>
                  <li>Message frequency varies based on case activity.</li>
                  <li>
                    NO mobile information will be shared with third parties or affiliates
                    for marketing or promotional purposes.
                  </li>
                  <li>
                    Information may be shared with subcontractors or service providers
                    solely to support customer service, technical operations, or message
                    delivery.
                  </li>
                  <li>
                    Text messaging originator opt-in data and consent will not be shared
                    with any third parties except as required by law.
                  </li>
                </ul>
              </div>

              <div className="text-sm text-muted-foreground space-y-2" data-testid="sms-consent-support">
                <p>
                  For support, email{" "}
                  <a href="mailto:support@casecurrent.co" className="text-primary hover:underline">
                    support@casecurrent.co
                  </a>{" "}
                  or call{" "}
                  <a href="tel:+15049005237" className="text-primary hover:underline">
                    (504) 900-5237
                  </a>
                  .
                </p>
                <p>
                  See our{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  for full details.
                </p>
              </div>

            </div>
          </div>
        </section>
      </SectionBackground>
    </PageShell>
  );
}
