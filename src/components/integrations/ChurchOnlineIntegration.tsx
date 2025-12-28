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
  Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChurchOnlineIntegrationProps {
  organizationId: string;
}

export function ChurchOnlineIntegration({ organizationId }: ChurchOnlineIntegrationProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [subdomain, setSubdomain] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Fetch existing Church Online integration
  const { data: integration, isLoading } = useQuery({
    queryKey: ['church-online-integration', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('service_name', 'church_online')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  // Create integration mutation
  const createIntegrationMutation = useMutation({
    mutationFn: async (subdomain: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Clean subdomain
      const cleanSubdomain = subdomain.replace(/\.online\.church$/i, '').trim().toLowerCase();

      // Test connection first
      const { data: testResult, error: testError } = await supabase.functions.invoke(
        'church-online-test-connection',
        { body: { subdomain: cleanSubdomain } }
      );

      if (testError || !testResult?.success) {
        throw new Error(testResult?.error || 'Failed to connect to Church Online Platform');
      }

      // Create integration
      const { data, error } = await supabase
        .from('integrations')
        .insert({
          service_name: 'church_online',
          status: 'active',
          credentials: {},
          settings: { 
            subdomain: cleanSubdomain,
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
      setSubdomain('');
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
    if (subdomain) {
      createIntegrationMutation.mutate(subdomain);
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

  const settings = integration?.settings as { subdomain?: string; organizationName?: string } | null;

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
              <Label htmlFor="co-subdomain">Your Church Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="co-subdomain"
                  placeholder="yourchurch"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">.online.church</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: If your URL is lifechurch.online.church, enter "lifechurch"
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleConnect}
                disabled={!subdomain || createIntegrationMutation.isPending}
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
                <p className="font-medium">{settings?.organizationName || settings?.subdomain}</p>
                <p className="text-sm text-muted-foreground">
                  {settings?.subdomain}.online.church
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
              <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 mt-2">
                <p className="text-xs">
                  <strong>Next step:</strong> Go to your{' '}
                  <a 
                    href={`https://${settings?.subdomain}.online.church/admin/settings/webhooks`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Church Online admin panel
                  </a>
                  {' '}→ Settings → Webhooks → Add the URL above for events like{' '}
                  <code className="bg-muted px-1 rounded">moment.interacted</code>,{' '}
                  <code className="bg-muted px-1 rounded">prayer.requested</code>,{' '}
                  <code className="bg-muted px-1 rounded">service.attended</code>
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
