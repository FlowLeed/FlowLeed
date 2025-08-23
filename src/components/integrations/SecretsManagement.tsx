import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Key, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Secret {
  name: string;
  description: string;
  required: boolean;
}

const PLANNING_CENTER_SECRETS: Secret[] = [
  {
    name: 'PLANNING_CENTER_CLIENT_ID',
    description: 'Your Planning Center OAuth Client ID',
    required: true
  },
  {
    name: 'PLANNING_CENTER_CLIENT_SECRET',
    description: 'Your Planning Center OAuth Client Secret',
    required: true
  }
];

const SecretsManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleSecretChange = (secretName: string, value: string) => {
    setSecrets(prev => ({
      ...prev,
      [secretName]: value
    }));
  };

  const toggleSecretVisibility = (secretName: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [secretName]: !prev[secretName]
    }));
  };

  const saveSecret = async (secretName: string) => {
    const value = secrets[secretName];
    if (!value?.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a value for the secret',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Call edge function to save secret
      const { error } = await supabase.functions.invoke('planning-center-integration', {
        body: {
          action: 'save_secret',
          secretName,
          secretValue: value.trim()
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${secretName} has been saved securely`
      });

      // Clear the input
      setSecrets(prev => ({
        ...prev,
        [secretName]: ''
      }));
    } catch (error) {
      console.error('Error saving secret:', error);
      toast({
        title: 'Error',
        description: 'Failed to save secret. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Key className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <CardTitle>Secrets Management</CardTitle>
            <CardDescription>
              Securely store API keys and secrets for your integrations
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Planning Center OAuth Setup</h4>
          <p className="text-sm text-blue-700 mb-3">
            To use OAuth with Planning Center, you need to register your application and get OAuth credentials.
          </p>
          <div className="space-y-2 text-sm text-blue-700">
            <p><strong>Authorization callback URL:</strong> <code>https://preview--flow-follow-up-friend.lovable.app/integrations</code></p>
            <p><strong>Redirect URI:</strong> Use the same URL as above</p>
          </div>
        </div>

        <div className="space-y-4">
          {PLANNING_CENTER_SECRETS.map((secret) => (
            <div key={secret.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={secret.name} className="text-sm font-medium">
                  {secret.name}
                  {secret.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {secret.description}
              </p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id={secret.name}
                    type={showSecrets[secret.name] ? 'text' : 'password'}
                    placeholder={`Enter your ${secret.name.split('_').slice(-1)[0].toLowerCase()}`}
                    value={secrets[secret.name] || ''}
                    onChange={(e) => handleSecretChange(secret.name, e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => toggleSecretVisibility(secret.name)}
                  >
                    {showSecrets[secret.name] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  onClick={() => saveSecret(secret.name)}
                  disabled={loading || !secrets[secret.name]?.trim()}
                  size="sm"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Secrets are encrypted and stored securely. They will be available for use in your integrations once saved.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecretsManagement;