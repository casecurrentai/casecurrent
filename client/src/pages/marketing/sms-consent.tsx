import { useState } from "react";
import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { Link } from "wouter";

export default function SmsConsentPage() {
    const [checked, setChecked] = useState(false);
    const [phone, setPhone] = useState("");

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
                                                          <div
                                                                            className="rounded-xl border border-border bg-card p-6 space-y-4"
                                                                            data-testid="sms-consent-form"
                                                                          >
                                                                          <h2 className="text-lg font-semibold text-foreground">
                                                                                            Consent to Receive Text Messages
                                                                          </h2>h2>
                                                                          <p className="text-sm text-muted-foreground leading-relaxed">
                                                                                            CaseCurrent may send case-related SMS communications only to
                                                                                            individuals who have voluntarily provided their mobile number
                                                                                            and affirmatively checked the consent box below.
                                                                          </p>p>
                                                          
                                                            {/* Phone number input field — required for A2P compliance */}
                                                                          <div className="space-y-1" data-testid="sms-phone-field">
                                                                                            <label
                                                                                                                  htmlFor="smsPhoneNumber"
                                                                                                                  className="text-sm font-medium text-foreground"
                                                                                                                >
                                                                                                                Mobile Phone Number
                                                                                              </label>label>
                                                                                            <input
                                                                                                                  type="tel"
                                                                                                                  id="smsPhoneNumber"
                                                                                                                  name="phone"
                                                                                                                  placeholder="(555) 555-5555"
                                                                                                                  value={phone}
                                                                                                                  onChange={(e) => setPhone(e.target.value)}
                                                                                                                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                                                                                                  data-testid="input-sms-phone"
                                                                                                                  aria-label="Mobile phone number for SMS consent"
                                                                                                                />
                                                                          </div>div>
                                                          
                                                                          <div
                                                                                              className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border"
                                                                                              data-testid="sms-consent-checkbox-block"
                                                                                            >
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
                                                                                                                                      I agree to receive case-related text messages. Message
                                                                                                                                      frequency varies. Message and data rates may apply. Reply
                                                                                                                                      STOP to opt out. Reply HELP for help.
                                                                                                                  </label>label>
                                                                                                                <p className="text-xs text-muted-foreground mt-2">
                                                                                                                                      Consent is not a condition of representation.
                                                                                                                  </p>p>
                                                                                              </div>div>
                                                                          </div>div>
                                                          
                                                                          <p
                                                                                              className="text-xs text-muted-foreground"
                                                                                              data-testid="sms-consent-opt-out-note"
                                                                                            >
                                                                                            To opt out at any time, reply <strong>STOP</strong>strong>. For
                                                                                            help, reply <strong>HELP</strong>strong>.
                                                                          </p>p>
                                                          </div>div>
                                            
                                                          <div
                                                                            className="rounded-xl border border-border bg-card p-6 space-y-3"
                                                                            data-testid="sms-consent-details"
                                                                          >
                                                                          <h3 className="text-base font-semibold text-foreground">
                                                                                            How We Use Your Number
                                                                          </h3>h3>
                                                                          <ul className="text-sm text-muted-foreground space-y-2 leading-relaxed list-disc list-inside">
                                                                                            <li>Messages are sent only in response to user-initiated inquiries.</li>li>
                                                                                            <li>
                                                                                                                Types of messages: intake follow-ups, scheduling updates,
                                                                                              case status notifications.
                                                                                              </li>li>
                                                                                            <li>Message frequency varies based on case activity.</li>li>
                                                                                            <li>
                                                                                                                NO mobile information will be shared with third parties or
                                                                                                                affiliates for marketing or promotional purposes.
                                                                                              </li>li>
                                                                                            <li>
                                                                                                                Information may be shared with subcontractors or service
                                                                                                                providers solely to support customer service, technical
                                                                                                                operations, or message delivery.
                                                                                              </li>li>
                                                                                            <li>
                                                                                                                Text messaging originator opt-in data and consent will not
                                                                                                                be shared with any third parties except as required by law.
                                                                                              </li>li>
                                                                          </ul>ul>
                                                          </div>div>
                                            
                                                          <div
                                                                            className="text-sm text-muted-foreground space-y-2"
                                                                            data-testid="sms-consent-support"
                                                                          >
                                                                          <p>
                                                                                            For support, email{" "}
                                                                                            <a
                                                                                                                  href="mailto:support@casecurrent.co"
                                                                                                                  className="text-primary hover:underline"
                                                                                                                >
                                                                                                                support@casecurrent.co
                                                                                              </a>a>{" "}
                                                                                            or call{" "}
                                                                                            <a
                                                                                                                  href="tel:+15049005237"
                                                                                                                  className="text-primary hover:underline"
                                                                                                                >
                                                                                                                (504) 900-5237
                                                                                              </a>a>
                                                                                            .
                                                                          </p>p>
                                                                          <p>
                                                                                            See our{" "}
                                                                                            <Link href="/privacy" className="text-primary hover:underline">
                                                                                                                Privacy Policy
                                                                                              </Link>Link>{" "}
                                                                                            and{" "}
                                                                                            <Link href="/terms" className="text-primary hover:underline">
                                                                                                                Terms of Service
                                                                                              </Link>Link>{" "}
                                                                                            for full details.
                                                                          </p>p>
                                                          </div>div>
                                            </div>div>
                                </div>div>
                      </section>section>
              </SectionBackground>SectionBackground>
        </PageShell>PageShell>
      );
}</PageShell>
