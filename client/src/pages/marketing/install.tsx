import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Share, Plus, MoreVertical, Download } from "lucide-react";
import { SiApple } from "react-icons/si";
import { FaAndroid } from "react-icons/fa";

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Install CaseCurrent</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-3xl font-bold text-primary-foreground">CC</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Get the CaseCurrent App</h2>
          <p className="text-muted-foreground">
            Install CaseCurrent on your phone for quick access to leads, calls, and analytics.
          </p>
        </div>

        <div className="space-y-6">
          <Card data-testid="card-ios-install">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <SiApple className="h-6 w-6" />
                iPhone / iPad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium">Open in Safari</p>
                    <p className="text-muted-foreground">This page must be opened in Safari (not Chrome or other browsers)</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium">Tap the Share button</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      Look for the <Share className="h-4 w-4 inline" /> icon at the bottom of the screen
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium">Scroll down and tap "Add to Home Screen"</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      Look for the <Plus className="h-4 w-4 inline border rounded" /> icon with "Add to Home Screen"
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                  <div>
                    <p className="font-medium">Tap "Add" in the top right</p>
                    <p className="text-muted-foreground">The CaseCurrent icon will appear on your home screen</p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card data-testid="card-android-install">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FaAndroid className="h-6 w-6" />
                Android
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium">Open in Chrome</p>
                    <p className="text-muted-foreground">This page should be opened in Chrome browser</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium">Tap the menu button</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      Look for the <MoreVertical className="h-4 w-4 inline" /> icon in the top right corner
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium">Tap "Install app" or "Add to Home screen"</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      Look for the <Download className="h-4 w-4 inline" /> icon or "Install" option
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                  <div>
                    <p className="font-medium">Confirm the installation</p>
                    <p className="text-muted-foreground">The CaseCurrent icon will appear on your home screen</p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground pt-4">
            <p>Once installed, open CaseCurrent from your home screen to use it like a native app.</p>
            <p className="mt-2">The app works offline for viewing cached data and syncs when you're back online.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
