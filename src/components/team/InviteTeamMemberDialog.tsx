import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

interface InviteTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent: () => void;
}

export const InviteTeamMemberDialog: React.FC<InviteTeamMemberDialogProps> = ({
  open,
  onOpenChange,
  onInviteSent
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const { organization, profile } = useProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organization || !profile) {
      toast.error("Organization or profile not found");
      return;
    }

    if (!email || !role) {
      toast.error("Please fill in all fields");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);

      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('user_id', profile.user_id);

      if (memberCheckError) throw memberCheckError;

      // Check if user already has a profile with this email
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (profileCheckError) throw profileCheckError;

      if (existingProfile) {
        // Check if this user is already a member of the organization
        const { data: existingOrgMember, error: orgMemberError } = await supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('user_id', existingProfile.user_id)
          .maybeSingle();

        if (orgMemberError) throw orgMemberError;

        if (existingOrgMember) {
          toast.error("This user is already a member of your organization");
          return;
        }
      }

      // Check if there's already a pending invitation
      const { data: existingInvitation, error: invitationCheckError } = await supabase
        .from('invitations')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('email', email.toLowerCase())
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (invitationCheckError) throw invitationCheckError;

      if (existingInvitation) {
        toast.error("There's already a pending invitation for this email");
        return;
      }

      // Generate a secure token for the invitation
      const token = crypto.randomUUID();

      // Create the invitation
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert({
          organization_id: organization.id,
          email: email.toLowerCase(),
          role: role,
          invited_by_user_id: profile.user_id,
          token: token
        });

      if (inviteError) throw inviteError;

      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setRole("member");
      onInviteSent();

    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("member");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to add a new member to your team. They'll receive an email with instructions to join.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {role === 'admin' 
                ? 'Can manage team members and access all features'
                : 'Can access flows and contacts but cannot manage team'
              }
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};