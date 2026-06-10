import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Loader2,
  Play,
  Settings,
  Info
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChurchOnlineIntegrationProps {
  organizationId: string;
}

export function ChurchOnlineIntegration({ organizationId }: ChurchOnlineIntegrationProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [domainInput, setDomainInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Parse domain input to detect custom domain vs subdomain
  const parseDomainInput = (input: string): { domain: string; isCustomDomain: boolean } => {
    let cleaned = input.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    
    if (cleaned.endsWith('.online.church')) {
      // Standard subdomain format
      return { domain: cleaned, isCustomDomain: false };
    } else if (cleaned.includes('.')) {
      // Custom domain (has dots but not .online.church)
      return { domain: cleaned, isCustomDomain: true };
    } else {
      // Just a subdomain entered without .online.church
      return { domain: `${cleaned}.online.church`, isCustomDomain: false };
    }
  };

  // Fetch existing Church Online integration
  const { data: integration, isLoading } = useQuery({
    queryKey: ['church-online-integration', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('id, organization_id, user_id, service_name, status, metadata, sync_frequency, last_sync_at, auto_sync_all_people, provider_account_name, oauth_scopes, auth_type, settings, created_at, updated_at')
        .eq('service_name', 'church_online')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  // Create integration mutation
  const createIntegrationMutation = useMutation({
    mutationFn: async (input: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { domain, isCustomDomain } = parseDomainInput(input);

      // Test connection first
      const { data: testResult, error: testError } = await supabase.functions.invoke(
        'church-online-test-connection',
        { body: { domain } }
      );

      if (testError || !testResult?.success) {
        throw new Error(testResult?.error || 'Failed to connect to Church Online Platform');
      }

      // Create integration with domain info
      const { data, error } = await supabase
        .from('integrations')
        .insert({
          service_name: 'church_online',
          status: 'active',
          credentials: {},
          settings: { 
            domain,
            isCustomDomain,
            organizationName: testResult.organization?.name
          },
          organization_id: organizationId,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return { integration: data, testResult };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['church-online-integration', organizationId] });
      setDomainInput('');
      toast.success('Connected to Church Online Platform', {
        description: `Successfully connected to ${data.testResult.organization?.name || 'your church'}`
      });
    },
    onError: (error: Error) => {
      toast.error('Connection Failed', {
        description: error.message
      });
    }
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!integration) return;
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', integration.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church-online-integration', organizationId] });
      toast.success('Disconnected from Church Online Platform');
    },
    onError: (error: Error) => {
      toast.error('Failed to disconnect', { description: error.message });
    }
  });

  // Test existing connection
  const handleTestConnection = async () => {
    if (!integration) return;
    setTestingConnection(true);
    
    try {
      const { data, error } = await supabase.functions.invoke(
        'church-online-test-connection',
        { body: { integrationId: integration.id } }
      );

      if (error || !data?.success) {
        toast.error('Connection Failed', { description: data?.error || 'Unable to connect' });
        // Update status to failed
        await supabase
          .from('integrations')
          .update({ status: 'failed' })
          .eq('id', integration.id);
      } else {
        toast.success('Connection Successful', {
          description: data.currentService 
            ? `Current service: ${data.currentService.title}` 
            : 'Connected successfully'
        });
        await supabase
          .from('integrations')
          .update({ status: 'active' })
          .eq('id', integration.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ['church-online-integration', organizationId] });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleConnect = () => {
    if (domainInput) {
      createIntegrationMutation.mutate(domainInput);
    }
  };

  const getWebhookUrl = () => {
    if (!integration) return '';
    return `https://lghamvpolwebtjwaxned.supabase.co/functions/v1/church-online-webhook?integration_id=${integration.id}`;
  };

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(getWebhookUrl());
    setWebhookCopied(true);
    toast.success('Webhook URL copied to clipboard');
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="secondary">Loading...</Badge>;
    }
    if (disconnectMutation.isPending) {
      return <Badge variant="secondary">Disconnecting...</Badge>;
    }
    if (integration?.status === 'active') {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    }
    if (integration?.status === 'failed') {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Connection Failed</Badge>;
    }
    if (integration) {
      return <Badge variant="secondary">Pending Setup</Badge>;
    }
    return <Badge variant="outline">Not Connected</Badge>;
  };

  const settings = integration?.settings as { 
    domain?: string; 
    subdomain?: string; // legacy
    isCustomDomain?: boolean;
    organizationName?: string;
  } | null;

  // Get the display domain (handles both new and legacy format)
  const getDisplayDomain = () => {
    if (settings?.domain) return settings.domain;
    if (settings?.subdomain) return `${settings.subdomain}.online.church`;
    return '';
  };

  // Get the admin webhook URL
  const getAdminWebhookUrl = () => {
    const domain = getDisplayDomain();
    return `https://${domain}/admin/integration/webhooks/webhook/new`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Play className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle>Church Online Platform</CardTitle>
              <CardDescription>Capture salvations, prayers & attendance</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Automatically route salvations to your New Believer flow, prayers to Pastoral Care, 
          and track online service attendance — all in real-time via webhooks.
        </p>

        {!integration ? (
          // Setup form
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">Quick Setup Guide</h4>
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>1.</strong> Enter your Church Online subdomain below</p>
                <p><strong>2.</strong> Copy the webhook URL after connecting</p>
                <p><strong>3.</strong> Paste it in your Church Online admin panel under Webhooks</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="co-domain">Your Church Online URL</Label>
              <Input 
                id="co-domain"
                placeholder="yourchurch.online.church or live.yourchurch.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your full Church Online URL (e.g., lifechurch.online.church) or custom domain (e.g., live.thepromisecenter.com)
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleConnect}
                disabled={!domainInput || createIntegrationMutation.isPending}
              >
                {createIntegrationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
              <Button variant="outline" asChild>
                <a 
                  href="https://developers.online.church/docs/getting-started" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  API Docs
                </a>
              </Button>
            </div>
          </div>
        ) : (
          // Connected state
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">{settings?.organizationName || getDisplayDomain()}</p>
                <p className="text-sm text-muted-foreground">
                  {getDisplayDomain()}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Test Connection'
                )}
              </Button>
            </div>

            <Separator />

            {/* Webhook URL */}
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Copy this URL and add it to your Church Online Platform webhooks settings.
              </p>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={getWebhookUrl()}
                  className="font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopyWebhook}
                >
                  {webhookCopied ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={getAdminWebhookUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Add Webhook in Church Online
                  </a>
                </Button>
              </div>

              {/* Webhook Setup Instructions */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3 mt-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Webhook Setup Instructions
                </h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Click "Add Webhook in Church Online" button above</li>
                  <li>Paste the webhook URL you copied</li>
                  <li>For "Which data would you like to send?" select: <strong className="text-foreground">"Send specific events"</strong></li>
                  <li>Enable these events:
                    <ul className="ml-6 mt-1 space-y-1">
                      <li>✓ <code className="bg-muted px-1 rounded text-xs">Salvation Decision</code> <span className="text-xs">(moment.interacted)</span></li>
                      <li>✓ <code className="bg-muted px-1 rounded text-xs">Prayer Request</code> <span className="text-xs">(prayer.requested)</span></li>
                      <li>✓ <code className="bg-muted px-1 rounded text-xs">Service Attended</code> <span className="text-xs">(service.attended)</span></li>
                    </ul>
                  </li>
                  <li>Save your webhook settings</li>
                </ol>
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Avoid "Send all events" — it generates high volume traffic
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/integrations/church-online/advanced')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure Automations
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
