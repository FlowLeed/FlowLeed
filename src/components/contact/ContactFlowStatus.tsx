import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowRight, Target, Plus, Workflow, Users, MessageSquare, Calendar, Settings, Heart, Star, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Puzzle, LayoutDashboard, BarChart3, UserCheck, X, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { AddToFlowDialog } from './AddToFlowDialog';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import type { LucideIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  id: string; // pipeline_contacts.id
  pipeline: Pipeline;
  currentStage: Stage;
  totalStages: number;
  progressPercentage: number;
  assignedToUserId?: string | null;
  duration?: number; // Duration in days
  completedAt?: string;
  enteredStartAt?: string;
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
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedFlowName, setSelectedFlowName] = useState<string>('');
  const [flowAssignments, setFlowAssignments] = useState<{ [flowId: string]: OrganizationMember | null }>({});
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [flowHistory, setFlowHistory] = useState<ContactFlow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
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
  
  
  // Fetch flow assignments on component mount and when flows change
  useEffect(() => {
    fetchFlowAssignments();
  }, [flows]);

  // Fetch organization members when reassign dialog opens
  useEffect(() => {
    if (showReassignDialog && organization) {
      fetchOrganizationMembers();
    }
  }, [showReassignDialog, organization]);

  // Fetch flow history when history section is expanded
  useEffect(() => {
    if (showHistory && flowHistory.length === 0) {
      fetchFlowHistory();
    }
  }, [showHistory]);

  const fetchFlowAssignments = async () => {
    if (!flows.length) return;

    try {
      const flowIds = flows.map(flow => flow.id);
      
      // Fetch pipeline_contacts to get assigned users for each flow
      const { data: pipelineContacts, error } = await supabase
        .from('pipeline_contacts')
        .select('id, assigned_to_user_id')
        .in('id', flowIds);

      if (error) throw error;

      // For each flow that has an assigned user, fetch their profile
      const assignments: { [flowId: string]: OrganizationMember | null } = {};
      
      for (const pc of pipelineContacts || []) {
        if (pc.assigned_to_user_id) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, full_name, email, avatar_url')
            .eq('user_id', pc.assigned_to_user_id)
            .single();

          if (!profileError && profileData) {
            assignments[pc.id] = {
              user_id: profileData.user_id,
              profiles: profileData
            };
          } else {
            assignments[pc.id] = null;
          }
        } else {
          assignments[pc.id] = null;
        }
      }

      setFlowAssignments(assignments);
    } catch (error) {
      console.error('Error fetching flow assignments:', error);
    }
  };

  const fetchFlowHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('pipeline_contacts')
        .select(`
          id,
          pipeline_id,
          stage_id,
          entered_start_at,
          completed_end_at,
          assigned_to_user_id,
          pipelines:pipeline_id (
            id,
            name,
            icon,
            description
          ),
          pipeline_stages:stage_id (
            id,
            name,
            color,
            stage_order
          )
        `)
        .eq('contact_id', contactId)
        .not('completed_end_at', 'is', null)
        .order('completed_end_at', { ascending: false });

      if (error) throw error;

      // Get total stages for each pipeline
      const pipelineIds = [...new Set(data?.map((d: any) => d.pipeline_id) || [])];
      const { data: stagesData } = await supabase
        .from('pipeline_stages')
        .select('pipeline_id, id')
        .in('pipeline_id', pipelineIds);

      const stageCounts = new Map<string, number>();
      stagesData?.forEach((s: any) => {
        stageCounts.set(s.pipeline_id, (stageCounts.get(s.pipeline_id) || 0) + 1);
      });

      const transformedHistory: ContactFlow[] = (data || []).map((item: any) => {
        const totalStages = stageCounts.get(item.pipeline_id) || 1;
        const progressPercentage = ((item.pipeline_stages.stage_order + 1) / totalStages) * 100;
        
        // Calculate duration in days
        let duration = 0;
        if (item.entered_start_at && item.completed_end_at) {
          const start = new Date(item.entered_start_at);
          const end = new Date(item.completed_end_at);
          duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          id: item.id,
          pipeline: item.pipelines,
          currentStage: item.pipeline_stages,
          totalStages,
          progressPercentage,
          assignedToUserId: item.assigned_to_user_id,
          completedAt: item.completed_end_at,
          enteredStartAt: item.entered_start_at,
          duration
        };
      });

      setFlowHistory(transformedHistory);
    } catch (error) {
      console.error('Error fetching flow history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchOrganizationMembers = async () => {
    if (!selectedFlowId) return;

    setLoadingMembers(true);
    try {
      // Fetch flow team members instead of organization members
      const flow = flows.find(f => f.id === selectedFlowId);
      if (!flow) return;

      const { data, error } = await supabase
        .from('pipeline_team_members')
        .select(`
          user_id,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('pipeline_id', flow.pipeline.id);

      if (error) throw error;

      const members: OrganizationMember[] = data.map((m: any) => ({
        user_id: m.user_id,
        profiles: m.profiles
      })).filter(member => member.profiles !== null);

      setOrganizationMembers(members);
    } catch (error) {
      console.error('Error fetching flow team members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleReassign = async (newUserId: string) => {
    if (!selectedFlowId) return;

    setReassigning(true);
    try {
      const { error } = await supabase
        .from('pipeline_contacts')
        .update({ assigned_to_user_id: newUserId === 'unassigned' ? null : newUserId })
        .eq('id', selectedFlowId);

      if (error) throw error;

      // Refresh flow assignments
      await fetchFlowAssignments();
      // Notify flows to refresh
      window.dispatchEvent(new Event('flow-assignment-updated'));
      setShowReassignDialog(false);
      setSelectedFlowId(null);
      toast({ title: "Flow assignment updated successfully" });
    } catch (error) {
      console.error('Error reassigning flow:', error);
      toast({ title: "Error updating flow assignment", variant: "destructive" });
    } finally {
      setReassigning(false);
    }
  };

  const handleReassignClick = (flowId: string) => {
    setSelectedFlowId(flowId);
    setShowReassignDialog(true);
  };

  const handleRemoveClick = (e: React.MouseEvent, flowId: string, flowName: string) => {
    e.stopPropagation();
    setSelectedFlowId(flowId);
    setSelectedFlowName(flowName);
    setShowRemoveDialog(true);
  };

  const handleRemoveFromFlow = async () => {
    if (!selectedFlowId) return;

    setRemoving(true);
    try {
      const { error } = await supabase
        .from('pipeline_contacts')
        .delete()
        .eq('id', selectedFlowId);

      if (error) throw error;

      toast({ title: "Contact removed from flow successfully" });
      setShowRemoveDialog(false);
      setSelectedFlowId(null);
      setSelectedFlowName('');
      
      // Reload the page to reflect the changes
      window.location.reload();
    } catch (error) {
      console.error('Error removing contact from flow:', error);
      toast({ title: "Error removing contact from flow", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const currentPipelineIds = flows.map(flow => flow.pipeline.id);
  
  const handleFlowClick = (pipelineId: string) => {
    navigate(`/flows/${pipelineId}`);
  };
  if (flows.length === 0) {
    return (
      <>
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

        <AddToFlowDialog
          open={showAddToFlowDialog}
          onOpenChange={setShowAddToFlowDialog}
          contactId={contactId}
          currentPipelineIds={currentPipelineIds}
        />
      </>
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
        {/* Flows Section with per-flow assignments */}
        {flows.map((flow) => {
          const assignedUser = flowAssignments[flow.id];
          return (
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
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary"
                  style={{ 
                    backgroundColor: flow.currentStage.color ? `${flow.currentStage.color}20` : undefined,
                    color: flow.currentStage.color || undefined 
                  }}
                >
                  {flow.currentStage.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => handleRemoveClick(e, flow.id, flow.pipeline.name)}
                  title="Remove from flow"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
          );
        })}

        {/* Flow History Section */}
        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full pt-2 border-t">
            {showHistory ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>View Flow History</span>
            {flowHistory.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {flowHistory.length}
              </Badge>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground">Loading history...</p>
            ) : flowHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed flows yet</p>
            ) : (
              flowHistory.map((flow) => (
                <div 
                  key={flow.id} 
                  className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/30 transition-colors opacity-75"
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
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Final Stage</span>
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
                    <Progress value={flow.progressPercentage} className="h-2" />
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Completed: {flow.completedAt ? new Date(flow.completedAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      }) : 'N/A'}
                    </span>
                    {flow.duration !== undefined && flow.duration > 0 && (
                      <span>Duration: {flow.duration} {flow.duration === 1 ? 'day' : 'days'}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CollapsibleContent>
        </Collapsible>
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
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={
                    loadingMembers ? "Loading team members..." : 
                    reassigning ? "Reassigning..." : 
                    "Select team member"
                  } />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="unassigned" className="bg-background hover:bg-muted">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                        <UserCheck className="h-3 w-3" />
                      </div>
                      Unassigned
                    </div>
                  </SelectItem>
                  {organizationMembers.map((member) => (
                    <SelectItem 
                      key={member.user_id} 
                      value={member.user_id}
                      className="bg-background hover:bg-muted"
                    >
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

      {/* Remove from Flow Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Flow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this contact from <strong>{selectedFlowName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromFlow}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};