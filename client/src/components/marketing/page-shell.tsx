import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { GuillocheUnderlay } from "./guilloche-pattern";

const NAV_LINKS = [
  { href: "/how-it-works", label: "Product" },
  { href: "/solutions", label: "Integrations" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
  { href: "/resources", label: "Resources" },
];

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function PageShell({ children, title, description }: PageShellProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (title) {
      document.title = title;
    }
    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', description);
    }
  }, [title, description]);

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <header className="sticky top-0 z-50 border-b border-border/50 h-16">
        <div className="absolute inset-0">
          <GuillocheUnderlay />
        </div>
        <div className="relative z-10 h-full bg-background/30 backdrop-blur-sm">
          <div className="container mx-auto px-6 h-full">
            <div className="flex items-center justify-between h-full">
              <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
                <img src="/brand/casecurrent-mark-transparent.png" alt="CaseCurrent" className="h-8 w-auto" />
                <span className="font-bold text-xl text-foreground">CaseCurrent</span>
              </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-muted-foreground",
                      location === link.href && "text-foreground bg-muted"
                    )}
                    data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm" data-testid="link-nav-login">
                  Sign In
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="sm" data-testid="link-nav-contact">
                  Contact Sales
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="sm" data-testid="link-nav-demo">
                  Book a Demo
                </Button>
              </Link>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-background">
            <nav className="container mx-auto px-6 py-4 space-y-2">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start",
                      location === link.href && "bg-muted"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-mobile-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
              <div className="pt-4 space-y-2">
                <Link href="/login">
                  <Button variant="outline" className="w-full" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-nav-login">
                    Sign In
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" className="w-full" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-nav-contact">
                    Contact Sales
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button className="w-full" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-nav-demo">
                    Book a Demo
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 relative z-10">{children}</main>

      <footer className="border-t border-border bg-muted/30 relative z-10">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/brand/casecurrent-mark-transparent.png" alt="CaseCurrent" className="h-6 w-auto" />
                <span className="font-bold text-foreground">CaseCurrent</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered intake and lead capture for modern law firms.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/how-it-works" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-how-it-works">How It Works</Link></li>
                <li><Link href="/solutions" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-solutions">Solutions</Link></li>
                <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-pricing">Pricing</Link></li>
                <li><Link href="/security" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-security">Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/resources" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-resources">Blog</Link></li>
                <li><Link href="/contact" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-contact">Contact Sales</Link></li>
                <li><Link href="/demo" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-demo">Book a Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/terms" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-terms">Terms of Service</Link></li>
                <li><span className="text-muted-foreground">Privacy Policy</span></li>
                <li>
                  <a href="tel:+15049005237" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-phone">(504) 900-5237</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            2025 CaseCurrent. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
