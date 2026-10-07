import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PasswordInput } from '@/components/ui/password-input';

export const SecuritySettings = () => {
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const { changeEmail, changePassword, user } = useAuth();
  const { toast } = useToast();
  
  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('change-email', {
        body: { newEmail },
      });

      if (error) throw error;

      toast({
        title: 'Verification email sent',
        description: 'Please check your new email address to confirm the change.',
      });
      setNewEmail('');
    } catch (error: any) {
      toast({
        title: 'Failed to change email',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setEmailLoading(false);
    }
  };
  
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
        variant: 'destructive',
      });
      setPasswordLoading(false);
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      setPasswordLoading(false);
      return;
    }
    
    const { error } = await changePassword(currentPassword, newPassword);
    
    if (error) {
      toast({
        title: 'Failed to change password',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Password changed successfully',
        description: 'Your password has been updated.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    
    setPasswordLoading(false);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>
          Manage your email and password
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Change Email</h3>
          </div>
          
          <Alert>
            <AlertDescription>
              Current email: <strong>{user?.email}</strong>
            </AlertDescription>
          </Alert>
          
          <form onSubmit={handleEmailChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email"
                required
              />
              <p className="text-xs text-muted-foreground">
                You'll receive a verification email at your new address
              </p>
            </div>
            
            <Button type="submit" disabled={emailLoading || !newEmail} className="w-full sm:w-auto">
              {emailLoading ? 'Sending verification...' : 'Change Email'}
            </Button>
          </form>
        </div>
        
        <div className="border-t pt-6" />
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Change Password</h3>
          </div>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>
            
            <Button type="submit" disabled={passwordLoading} className="w-full sm:w-auto">
              {passwordLoading ? 'Changing password...' : 'Change Password'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
