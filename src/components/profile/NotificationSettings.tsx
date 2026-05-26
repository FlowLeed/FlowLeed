import React, { useEffect, useState } from "react";
import { Bell, Mail, Smartphone, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getCurrentSubscription,
  getPermission,
  isIOS,
  isPushSupported,
  isStandalone,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

interface NotificationSettingsProps {
  emailDigestEnabled: boolean;
  onEmailDigestChange: (enabled: boolean) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  emailDigestEnabled,
  onEmailDigestChange,
}) => {
  const { toast } = useToast();
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [working, setWorking] = useState(false);
  const iosNeedsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    setPushSupported(isPushSupported());
    (async () => {
      setPermission(await getPermission());
      const sub = await getCurrentSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  const handlePushToggle = async (next: boolean) => {
    setWorking(true);
    try {
      if (next) {
        await subscribeToPush();
        setSubscribed(true);
        setPermission("granted");
        toast({ title: "Push notifications enabled" });
      } else {
        await unsubscribeFromPush();
        setSubscribed(false);
        toast({ title: "Push notifications disabled" });
      }
    } catch (e) {
      toast({
        title: "Couldn't update push notifications",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const handleTest = async () => {
    setWorking(true);
    try {
      await sendTestPush();
      toast({ title: "Test push sent", description: "Check your device for the notification." });
    } catch (e) {
      toast({ title: "Test failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Bell className="h-5 w-5 text-sidebar-foreground" />
          </div>
          <div>
            <CardTitle className="font-light">Notification Preferences</CardTitle>
            <CardDescription>Choose how you want to be notified about updates</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Push notifications */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-1 min-w-0">
              <Label className="text-sm font-medium">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get instant alerts on this device for new assignments and updates.
              </p>
              {!pushSupported && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Not supported in this browser.
                </p>
              )}
              {pushSupported && iosNeedsInstall && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> On iOS, add Flow to your Home Screen first (Share → Add to Home Screen).
                </p>
              )}
              {permission === "denied" && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Notifications are blocked. Enable them in your browser settings.
                </p>
              )}
              {subscribed && (
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Enabled on this device
                  </p>
                  <Button size="sm" variant="outline" onClick={handleTest} disabled={working}>
                    Send test
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={subscribed}
            disabled={working || !pushSupported || permission === "denied" || iosNeedsInstall}
            onCheckedChange={handlePushToggle}
          />
        </div>

        <Separator />

        {/* Email digest */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <Label className="text-sm font-medium">Daily Email Digest</Label>
              <p className="text-sm text-muted-foreground">
                Receive a daily email summary of new people assigned to you.
                Sent every morning at 8 AM UTC.
              </p>
            </div>
          </div>
          <Switch
            checked={emailDigestEnabled}
            onCheckedChange={onEmailDigestChange}
          />
        </div>

        <Separator />

        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> In-app notifications are always enabled.
            The bell icon in the header will show you real-time updates about new assignments.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
