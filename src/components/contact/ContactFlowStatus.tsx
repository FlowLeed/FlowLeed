import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Target, Plus, Workflow, Users, MessageSquare, Calendar, Settings, Heart, Star, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Puzzle, LayoutDashboard, BarChart3, UserCheck } from 'lucide-react';
import { AddToFlowDialog } from './AddToFlowDialog';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import type { LucideIcon } from 'lucide-react';

interface Pipeline {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
  stage_order: number;
}

interface ContactFlow {
  pipeline: Pipeline;
  currentStage: Stage;
  totalStages: number;
  progressPercentage: number;
}

interface OrganizationMember {
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface Contact {
  id: string;
  assigned_to_user_id: string | null;
}

interface ContactFlowStatusProps {
  flows: ContactFlow[];
  contactId: string;
}

export const ContactFlowStatus: React.FC<ContactFlowStatusProps> = ({ flows, contactId }) => {
  const [showAddToFlowDialog, setShowAddToFlowDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [assignedUser, setAssignedUser] = useState<OrganizationMember | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const navigate = useNavigate();
  const { organization } = useProfile();
  
  // Icon mapping object
  const iconMap: { [key: string]: LucideIcon } = {
    'Users': Users,
    'MessageSquare': MessageSquare,
    'Calendar': Calendar,
    'Settings': Settings,
    'Heart': Heart,
    'Star': Star,
    'Target': Target,
    'Zap': Zap,
    'Shield': Shield,
    'Globe': Globe,
    'Briefcase': Briefcase,
    'BookOpen': BookOpen,
    'Music': Music,
    'Coffee': Coffee,
    'Camera': Camera,
    'Gift': Gift,
    'Flame': Flame,
    'Sparkles': Sparkles,
    'Check': Check,
    'Plus': Plus,
    'Puzzle': Puzzle,
    'LayoutDashboard': LayoutDashboard,
    'BarChart3': BarChart3
  };
  
  
  // Fetch contact and assigned user data
  useEffect(() => {
    fetchContactData();
  }, [contactId]);

  // Fetch organization members when reassign dialog opens
  useEffect(() => {
    if (showReassignDialog && organization) {
      fetchOrganizationMembers();
    }
  }, [showReassignDialog, organization]);

  const fetchContactData = async () => {
    if (!contactId) return;

    try {
      // Fetch contact details
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, assigned_to_user_id')
        .eq('id', contactId)
        .single();

      if (contactError) throw contactError;
      setContact(contactData);

      // If contact has assigned user, fetch their profile
      if (contactData.assigned_to_user_id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .eq('user_id', contactData.assigned_to_user_id)
          .single();

        if (!profileError && profileData) {
          setAssignedUser({
            user_id: profileData.user_id,
            profiles: profileData
          });
        }
      } else {
        setAssignedUser(null);
      }
    } catch (error) {
      console.error('Error fetching contact data:', error);
    }
  };

  const fetchOrganizationMembers = async () => {
    if (!organization) return;

    setLoadingMembers(true);
    try {
      // First get organization members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization.id);

      if (membersError) throw membersError;

      if (members && members.length > 0) {
        // Then get profiles for these users
        const userIds = members.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        // Combine the data
        const combinedData: OrganizationMember[] = members.map(member => ({
          user_id: member.user_id,
          profiles: profiles?.find(p => p.user_id === member.user_id) || null
        })).filter(member => member.profiles !== null);

        setOrganizationMembers(combinedData);
      }
    } catch (error) {
      console.error('Error fetching organization members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleReassign = async (newUserId: string) => {
    if (!contact) return;

    setReassigning(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ assigned_to_user_id: newUserId === 'unassigned' ? null : newUserId })
        .eq('id', contact.id);

      if (error) throw error;

      // Refresh contact data
      await fetchContactData();
      setShowReassignDialog(false);
      toast({ title: "Contact reassigned successfully" });
    } catch (error) {
      console.error('Error reassigning contact:', error);
      toast({ title: "Error reassigning contact", variant: "destructive" });
    } finally {
      setReassigning(false);
    }
  };

  const currentPipelineIds = flows.map(flow => flow.pipeline.id);
  
  const handleFlowClick = (pipelineId: string) => {
    navigate(`/pipelines/${pipelineId}`);
  };
  if (flows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Current Flows
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddToFlowDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add to Flow
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active flows</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Current Flows
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddToFlowDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add to Flow
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Assignment Section */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-medium text-muted-foreground">Assigned To</h5>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReassignDialog(true)}
              className="text-xs"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Reassign
            </Button>
          </div>
          {assignedUser ? (
            <div 
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => setShowReassignDialog(true)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={assignedUser.profiles?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {assignedUser.profiles?.full_name?.[0] || assignedUser.profiles?.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">
                {assignedUser.profiles?.full_name || assignedUser.profiles?.email || 'Unknown User'}
              </span>
            </div>
          ) : (
            <div 
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors text-muted-foreground"
              onClick={() => setShowReassignDialog(true)}
            >
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                <UserCheck className="h-3 w-3" />
              </div>
              <span className="text-sm">Unassigned</span>
            </div>
          )}
        </div>

        {/* Flows Section */}
        {flows.map((flow) => (
          <div 
            key={flow.pipeline.id} 
            className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleFlowClick(flow.pipeline.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  if (flow.pipeline.icon && iconMap[flow.pipeline.icon]) {
                    const IconComponent = iconMap[flow.pipeline.icon];
                    return <IconComponent className="h-5 w-5 text-muted-foreground" />;
                  }
                  return <Workflow className="h-5 w-5 text-muted-foreground" />;
                })()}
                <h4 className="font-medium">{flow.pipeline.name}</h4>
              </div>
              <Badge 
                variant="secondary"
                style={{ 
                  backgroundColor: flow.currentStage.color ? `${flow.currentStage.color}20` : undefined,
                  color: flow.currentStage.color || undefined 
                }}
              >
                {flow.currentStage.name}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-muted-foreground">
                  Stage {flow.currentStage.stage_order} of {flow.totalStages}
                </span>
              </div>
              <Progress value={flow.progressPercentage} className="h-2" />
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
              <span>Next: Continue in {flow.pipeline.name}</span>
            </div>
          </div>
        ))}
      </CardContent>
      
      <AddToFlowDialog
        open={showAddToFlowDialog}
        onOpenChange={setShowAddToFlowDialog}
        contactId={contactId}
        currentPipelineIds={currentPipelineIds}
      />

      {/* Reassignment Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reassign Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to team member:</label>
              <Select
                onValueChange={handleReassign}
                disabled={loadingMembers || reassigning}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    loadingMembers ? "Loading team members..." : 
                    reassigning ? "Reassigning..." : 
                    "Select team member"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                        <UserCheck className="h-3 w-3" />
                      </div>
                      Unassigned
                    </div>
                  </SelectItem>
                  {organizationMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {member.profiles?.full_name?.[0] || member.profiles?.email?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {member.profiles?.full_name || member.profiles?.email || 'Unknown User'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};