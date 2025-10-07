import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, X, Star, Wrench, User, Users, MessageSquare, Calendar, Settings, Heart, Target, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Puzzle, LayoutDashboard, BarChart3, GripVertical, Trash2, Plus as PlusIcon, Workflow as FlowIcon } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import type { LucideIcon } from "lucide-react";

interface FlowTeamMember {
  id: string;
  user_id: string;
  role: 'lead' | 'manager' | 'contributor';
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface OrganizationMember {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface FlowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  flowName: string;
  flowDescription?: string;
  flowIcon?: string;
  flowStages?: Array<{id: string, name: string, color: string, stage_order: number}>;
  organizationId: string;
  onSave?: () => void;
}

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
  'Puzzle': Puzzle,
  'LayoutDashboard': LayoutDashboard,
  'BarChart3': BarChart3
};

const STAGE_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e"
];

export const FlowSettingsDialog = ({
  open,
  onOpenChange,
  flowId,
  flowName: initialFlowName,
  flowDescription: initialFlowDescription = "",
  flowIcon: initialFlowIcon,
  flowStages: initialFlowStages = [],
  organizationId,
  onSave,
}: FlowSettingsDialogProps) => {
  const [activeTab, setActiveTab] = useState("details");
  
  // Flow details state
  const [flowName, setFlowName] = useState(initialFlowName);
  const [flowDescription, setFlowDescription] = useState(initialFlowDescription);
  const [flowIcon, setFlowIcon] = useState<LucideIcon>(Users);
  const [flowSteps, setFlowSteps] = useState<Array<{id: string, name: string, color: string, stage_order: number}>>(initialFlowStages);
  
  // Team management state
  const [teamMembers, setTeamMembers] = useState<FlowTeamMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<'contributor' | 'manager'>('contributor');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Initialize flow data when dialog opens
  useEffect(() => {
    if (open) {
      setFlowName(initialFlowName);
      setFlowDescription(initialFlowDescription);
      setFlowSteps(initialFlowStages);
      
      if (initialFlowIcon && iconMap[initialFlowIcon]) {
        setFlowIcon(iconMap[initialFlowIcon]);
      } else {
        setFlowIcon(FlowIcon);
      }
      
      fetchTeamMembers();
      fetchOrgMembers();
    }
  }, [open, flowId, initialFlowName, initialFlowDescription, initialFlowIcon, initialFlowStages]);

  const fetchTeamMembers = async () => {
    setLoading(true);
    try {
      const { data: teamData, error: teamError } = await supabase
        .from("pipeline_team_members")
        .select("id, user_id, role")
        .eq("pipeline_id", flowId)
        .order("role", { ascending: true });

      if (teamError) throw teamError;

      if (!teamData || teamData.length === 0) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      const userIds = teamData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const members = teamData.map((m) => {
        const profile = profilesData?.find(p => p.user_id === m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as 'lead' | 'manager' | 'contributor',
          full_name: profile?.full_name || null,
          email: profile?.email || "",
          avatar_url: profile?.avatar_url || null,
        };
      });

      setTeamMembers(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgMembers = async () => {
    try {
      const { data: orgData, error: orgError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId);

      if (orgError) throw orgError;

      if (!orgData || orgData.length === 0) {
        setOrgMembers([]);
        return;
      }

      const userIds = orgData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const members = orgData.map((m) => {
        const profile = profilesData?.find(p => p.user_id === m.user_id);
        return {
          user_id: m.user_id,
          full_name: profile?.full_name || null,
          email: profile?.email || "",
          avatar_url: profile?.avatar_url || null,
        };
      });

      setOrgMembers(members);
    } catch (error) {
      console.error("Error fetching organization members:", error);
      toast({
        title: "Error",
        description: "Failed to load organization members",
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    const { error } = await supabase
      .from("pipeline_team_members")
      .insert({
        pipeline_id: flowId,
        user_id: selectedUserId,
        role: selectedRole,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add team member",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Team member added successfully",
      });
      fetchTeamMembers();
      setSelectedUserId("");
      setSelectedRole('contributor');
    }
    setLoading(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("pipeline_team_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Team member removed successfully",
      });
      fetchTeamMembers();
    }
    setLoading(false);
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("pipeline_team_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Role updated successfully",
      });
      fetchTeamMembers();
    }
    setLoading(false);
  };

  const handleSaveFlow = async () => {
    if (!flowName.trim()) {
      toast({
        title: "Error",
        description: "Flow name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const iconKey = Object.keys(iconMap).find(key => iconMap[key] === flowIcon) || 'Users';
      
      const { error: flowError } = await supabase
        .from('pipelines')
        .update({
          name: flowName,
          description: flowDescription,
          icon: iconKey,
        })
        .eq('id', flowId);

      if (flowError) throw flowError;

      // Update stages
      for (const step of flowSteps) {
        const { error: stageError } = await supabase
          .from('pipeline_stages')
          .update({
            name: step.name,
            color: step.color,
            stage_order: step.stage_order
          })
          .eq('id', step.id);

        if (stageError) throw stageError;
      }

      toast({
        title: "Success",
        description: `Flow "${flowName}" updated successfully`,
      });

      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating flow:', error);
      toast({
        title: "Error",
        description: "Failed to update flow",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addNewStep = () => {
    const usedColors = flowSteps.map(step => step.color);
    const availableColor = STAGE_COLORS.find(c => !usedColors.includes(c)) || STAGE_COLORS[0];
    
    setFlowSteps([...flowSteps, { 
      id: `temp-${Date.now()}`,
      name: `Stage ${flowSteps.length + 1}`, 
      color: availableColor,
      stage_order: flowSteps.length
    }]);
  };

  const removeStep = (index: number) => {
    if (flowSteps.length > 1) {
      setFlowSteps(flowSteps.filter((_, i) => i !== index));
    }
  };

  const updateStepName = (index: number, name: string) => {
    const updatedSteps = [...flowSteps];
    updatedSteps[index].name = name;
    setFlowSteps(updatedSteps);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(flowSteps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    const updatedItems = items.map((item, index) => ({
      ...item,
      stage_order: index
    }));
    
    setFlowSteps(updatedItems);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'lead':
        return <Star className="h-4 w-4" />;
      case 'manager':
        return <Wrench className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const availableMembers = orgMembers.filter(
    (om) => !teamMembers.some((tm) => tm.user_id === om.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Flow Settings - {initialFlowName}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Flow Details</TabsTrigger>
            <TabsTrigger value="team">Team Members</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Flow Name and Icon */}
            <div className="space-y-2">
              <Label htmlFor="flow-name">Flow Name</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                      {React.createElement(flowIcon, { className: "h-4 w-4" })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="grid grid-cols-6 gap-2">
                      {Object.entries(iconMap).map(([name, IconComponent]) => (
                        <Button
                          key={name}
                          variant="outline"
                          size="icon"
                          onClick={() => setFlowIcon(IconComponent)}
                          className={
                            flowIcon === IconComponent ? 'bg-primary/10 border-primary' : ''
                          }
                        >
                          <IconComponent className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  id="flow-name"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="Enter flow name"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Flow Description */}
            <div className="space-y-2">
              <Label htmlFor="flow-description">Description</Label>
              <Textarea
                id="flow-description"
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                placeholder="Enter flow description (optional)"
                rows={3}
              />
            </div>

            {/* Flow Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Flow Steps</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNewStep}
                  className="gap-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Step
                </Button>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="steps">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {flowSteps.map((step, index) => (
                        <Draggable
                          key={step.id}
                          draggableId={step.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="flex items-center gap-2 p-3 border rounded-md bg-background"
                            >
                              <div {...provided.dragHandleProps}>
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <Input
                                value={step.name}
                                onChange={(e) => updateStepName(index, e.target.value)}
                                className="flex-1"
                              />
                              <input
                                type="color"
                                value={step.color}
                                onChange={(e) => {
                                  const updatedSteps = [...flowSteps];
                                  updatedSteps[index].color = e.target.value;
                                  setFlowSteps(updatedSteps);
                                }}
                                className="w-10 h-10 rounded cursor-pointer"
                              />
                              {flowSteps.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeStep(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveFlow} disabled={loading}>
                Save Changes
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="team" className="space-y-4 mt-4">
            {/* Add New Member Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Add Team Member</h3>
              <div className="flex gap-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'contributor' | 'manager')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contributor">Contributor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleAddMember}
                  disabled={!selectedUserId || loading}
                  size="icon"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Current Team Members */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Team Members ({teamMembers.length})</h3>
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>
                          {(member.full_name || member.email)
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {member.full_name || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleChangeRole(member.id, v)}
                        disabled={member.role === 'lead' || loading}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              {getRoleIcon(member.role)}
                              <span className="capitalize">{member.role}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead" disabled>Lead</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="contributor">Contributor</SelectItem>
                        </SelectContent>
                      </Select>

                      {member.role !== 'lead' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
