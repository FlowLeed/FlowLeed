import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Mail, MessageSquare, Bell, Send, Settings, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TwilioConfigSection } from "@/components/admin/TwilioConfigSection";

const CommunicationsPage = () => {
  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-light mb-2">Communications</h1>
        <p className="text-muted-foreground">
          Manage system-wide communication settings, templates, and notifications
        </p>
      </div>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Templates
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="twilio" className="gap-2">
            <Phone className="h-4 w-4" />
            Twilio
          </TabsTrigger>
        </TabsList>

        {/* Email Templates Tab */}
        <TabsContent value="email" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Welcome Email
                  <Badge variant="outline">Active</Badge>
                </CardTitle>
                <CardDescription>
                  Sent to new users when they sign up or are invited
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="welcome-subject">Subject Line</Label>
                  <Input
                    id="welcome-subject"
                    placeholder="Welcome to Flowleed!"
                    defaultValue="Welcome to Flowleed!"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcome-body">Email Body</Label>
                  <Textarea
                    id="welcome-body"
                    rows={8}
                    placeholder="Enter email content..."
                    defaultValue="Hi {{name}},&#10;&#10;Welcome to Flowleed! We're excited to have you on board.&#10;&#10;Your organization: {{organization_name}}&#10;&#10;Get started by exploring your dashboard and connecting with your team."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch id="welcome-enabled" defaultChecked />
                    <Label htmlFor="welcome-enabled">Enable this template</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Send className="h-4 w-4 mr-2" />
                      Send Test
                    </Button>
                    <Button size="sm">Save Changes</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Password Reset
                  <Badge variant="outline">Active</Badge>
                </CardTitle>
                <CardDescription>
                  Sent when a user requests to reset their password
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-subject">Subject Line</Label>
                  <Input
                    id="reset-subject"
                    placeholder="Reset your password"
                    defaultValue="Reset Your Flowleed Password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-body">Email Body</Label>
                  <Textarea
                    id="reset-body"
                    rows={8}
                    placeholder="Enter email content..."
                    defaultValue="Hi {{name}},&#10;&#10;We received a request to reset your password. Click the link below to set a new password:&#10;&#10;{{reset_link}}&#10;&#10;This link will expire in 24 hours.&#10;&#10;If you didn't request this, please ignore this email."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch id="reset-enabled" defaultChecked />
                    <Label htmlFor="reset-enabled">Enable this template</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Send className="h-4 w-4 mr-2" />
                      Send Test
                    </Button>
                    <Button size="sm">Save Changes</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Team Invitation
                  <Badge variant="outline">Active</Badge>
                </CardTitle>
                <CardDescription>
                  Sent when a user is invited to join an organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-subject">Subject Line</Label>
                  <Input
                    id="invite-subject"
                    placeholder="You've been invited to join..."
                    defaultValue="You've Been Invited to {{organization_name}}"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-body">Email Body</Label>
                  <Textarea
                    id="invite-body"
                    rows={8}
                    placeholder="Enter email content..."
                    defaultValue="Hi there,&#10;&#10;{{inviter_name}} has invited you to join {{organization_name}} on Flowleed.&#10;&#10;Click the link below to accept the invitation:&#10;&#10;{{invitation_link}}&#10;&#10;We look forward to seeing you!"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch id="invite-enabled" defaultChecked />
                    <Label htmlFor="invite-enabled">Enable this template</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Send className="h-4 w-4 mr-2" />
                      Send Test
                    </Button>
                    <Button size="sm">Save Changes</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SMS Templates Tab */}
        <TabsContent value="sms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SMS Templates</CardTitle>
              <CardDescription>
                Manage SMS message templates for automated communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">SMS templates will be available soon</p>
                <Button variant="outline" disabled>
                  Create SMS Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Notifications</CardTitle>
              <CardDescription>
                Configure in-app notification settings for all users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Task Assignments</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify users when tasks are assigned to them
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Contact Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify users of changes to contacts they're following
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Flow Stage Changes</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify users when contacts move through flow stages
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Team Mentions</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify users when they're mentioned in notes or comments
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>System Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify users about platform updates and maintenance
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>
              <div className="pt-4">
                <Button>Save Notification Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Service Configuration</CardTitle>
              <CardDescription>
                Configure SMTP settings and email service provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input
                  id="smtp-host"
                  placeholder="smtp.example.com"
                  defaultValue="smtp.sendgrid.net"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input id="smtp-port" placeholder="587" defaultValue="587" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">SMTP Username</Label>
                  <Input
                    id="smtp-user"
                    placeholder="apikey"
                    defaultValue="apikey"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-email">From Email Address</Label>
                <Input
                  id="from-email"
                  type="email"
                  placeholder="noreply@flowleed.com"
                  defaultValue="noreply@flowleed.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-name">From Name</Label>
                <Input
                  id="from-name"
                  placeholder="Flowleed"
                  defaultValue="Flowleed"
                />
              </div>
              <div className="pt-4">
                <Button>Update Email Settings</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Communication Preferences</CardTitle>
              <CardDescription>
                Set default communication preferences for all organizations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Bulk Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow organizations to send bulk emails to contacts
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Email Verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Require new users to verify their email address
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Unsubscribe Link</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically add unsubscribe links to all emails
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="pt-4">
                <Button>Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Twilio Tab */}
        <TabsContent value="twilio" className="space-y-6">
          <TwilioConfigSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationsPage;
