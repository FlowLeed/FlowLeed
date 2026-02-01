import React from "react";
import { Bell, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface NotificationSettingsProps {
  emailDigestEnabled: boolean;
  onEmailDigestChange: (enabled: boolean) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  emailDigestEnabled,
  onEmailDigestChange,
}) => {
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
