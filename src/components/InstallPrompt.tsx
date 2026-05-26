import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isIOS, isStandalone } from "@/lib/push";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "flow-install-dismissed-at";

export const InstallPrompt = ({ variant = "card" }: { variant?: "card" | "button" }) => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      if (v && Date.now() - Number(v) < 1000 * 60 * 60 * 24 * 7) setDismissed(true);
    } catch {}

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else if (isIOS()) {
      setShowIosHint(true);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissed(true);
  };

  if (installed) {
    return variant === "card" ? (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Download className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <p className="font-medium text-sm">Flow is installed</p>
            <p className="text-xs text-muted-foreground">You're running the app from your home screen.</p>
          </div>
        </CardContent>
      </Card>
    ) : null;
  }

  const canInstall = !!deferred || isIOS();
  if (!canInstall || dismissed) return null;

  if (variant === "button") {
    return (
      <Button size="sm" variant="outline" onClick={handleInstall}>
        <Download className="h-4 w-4 mr-2" />
        Install app
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Download className="h-5 w-5 text-blue-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Install Flow on this device</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isIOS()
                ? "Open this site in Safari, tap Share, then Add to Home Screen."
                : "Get a native-app feel with home-screen access and push notifications."}
            </p>
            {showIosHint && isIOS() && (
              <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2"><Share className="h-3 w-3" /> 1. Tap the Share icon in Safari</div>
                <div className="flex items-center gap-2"><Plus className="h-3 w-3" /> 2. Tap "Add to Home Screen"</div>
                <div>3. Open Flow from your home screen — done.</div>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              {deferred && (
                <Button size="sm" onClick={handleInstall}>
                  <Download className="h-4 w-4 mr-2" />
                  Install
                </Button>
              )}
              {isIOS() && !deferred && !showIosHint && (
                <Button size="sm" variant="outline" onClick={() => setShowIosHint(true)}>
                  Show me how
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                <X className="h-4 w-4 mr-1" /> Not now
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
