
import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Bell, Search, LogOut, User, Settings, Workflow, Settings2, Users, MessageSquare, Calendar, Heart, Star, Target, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Puzzle, LayoutDashboard, BarChart3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePipelineContext } from "@/contexts/PipelineContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";

interface HeaderProps {
  title: string;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showAddButton = true,
  onAddClick,
  addButtonLabel = "New Person"
}) => {
  const { user, signOut } = useAuth();
  const { profile, organization } = useProfile();
  const { pipelines, updatePipeline } = usePipelineContext();
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Edit flow dialog state
  const [showEditFlowDialog, setShowEditFlowDialog] = useState(false);
  const [editFlowName, setEditFlowName] = useState("");
  const [editFlowDescription, setEditFlowDescription] = useState("");
  const [editFlowIcon, setEditFlowIcon] = useState<LucideIcon>(Users);
  const [editFlowSteps, setEditFlowSteps] = useState<Array<{id: string, name: string, color: string}>>([]);

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

  // Get the current pipeline and its icon
  const currentPipeline = pipelineId ? Object.values(pipelines).find(p => p.id === pipelineId) : null;
  let FlowIcon = Workflow; // Default fallback

  if (currentPipeline?.icon && iconMap[currentPipeline.icon]) {
    FlowIcon = iconMap[currentPipeline.icon];
  } else if (currentPipeline) {
    // Fallback to name-based icon selection
    const name = currentPipeline.name.toLowerCase();
    if (name.includes('pastoral') || name.includes('care')) {
      FlowIcon = MessageSquare;
    } else if (name.includes('operation') || name.includes('ops')) {
      FlowIcon = Calendar;
    } else if (name.includes('host') || name.includes('team')) {
      FlowIcon = Users;
    } else if (name.includes('giving') || name.includes('hub')) {
      FlowIcon = Heart;
    }
  }

  const iconOptions = [
    Users, MessageSquare, Calendar, Settings, Heart, Star, Target, Zap,
    Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift,
    Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3
  ];

  const colorOptions = [
    "#3b82f6", "#f59e0b", "#10b981", "#6366f1", 
    "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"
  ];

  const openEditDialog = () => {
    if (currentPipeline) {
      setEditFlowName(currentPipeline.name);
      setEditFlowDescription(""); // Add description field to pipeline type if needed
      
      // Set icon
      if (currentPipeline.icon && iconMap[currentPipeline.icon]) {
        setEditFlowIcon(iconMap[currentPipeline.icon]);
      } else {
        setEditFlowIcon(FlowIcon);
      }
      
      // Set steps from current pipeline stages
      setEditFlowSteps(currentPipeline.stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        color: stage.color || "#3b82f6"
      })));
      
      setShowEditFlowDialog(true);
    }
  };

  const handleSaveFlow = async () => {
    if (!currentPipeline || !editFlowName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a flow name",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedPipeline = {
        ...currentPipeline,
        name: editFlowName,
        icon: Object.keys(iconMap).find(key => iconMap[key] === editFlowIcon) || 'Users',
        stages: editFlowSteps.map((step, index) => ({
          id: step.id,
          name: step.name,
          color: step.color,
          contacts: currentPipeline.stages.find(s => s.id === step.id)?.contacts || []
        }))
      };

      await updatePipeline(currentPipeline.id, updatedPipeline);
      
      toast({
        title: "Flow Updated",
        description: `Flow "${editFlowName}" updated successfully`,
      });
      
      setShowEditFlowDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const addStep = () => {
    const usedColors = editFlowSteps.map(step => step.color);
    const newColor = colorOptions.find(color => !usedColors.includes(color)) || "#64748b";
    setEditFlowSteps([...editFlowSteps, { 
      id: "", // Will be generated when saved
      name: "", 
      color: newColor 
    }]);
  };

  const removeStep = (index: number) => {
    if (editFlowSteps.length > 1) {
      setEditFlowSteps(editFlowSteps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, field: 'name' | 'color', value: string) => {
    const updatedSteps = [...editFlowSteps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setEditFlowSteps(updatedSteps);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = profile?.full_name 
    ? profile.full_name.split(' ').map(name => name.charAt(0)).join('').toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';
  return (
    <div className="flex items-center justify-between h-16 px-6 border-b border-crm-border">
      <div className="flex items-center gap-3">
        <FlowIcon className="h-6 w-6 text-primary" />
        <div className="text-xl font-semibold">{title}</div>
        <Button variant="ghost" size="sm" className="ml-2" onClick={openEditDialog}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-slate-100">
            <Bell className="h-5 w-5 text-slate-500" />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100">
            <Search className="h-5 w-5 text-slate-500" />
          </button>
          <div className="border-l border-gray-200 h-6 mx-2" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">{displayName}</span>
                  {organization && (
                    <span className="text-xs text-muted-foreground">{organization.name}</span>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div>
                  <div className="font-medium">{displayName}</div>
                  <div className="text-sm font-normal text-muted-foreground">{user?.email}</div>
                  {organization && (
                    <div className="text-xs font-normal text-muted-foreground">{organization.name}</div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Edit Flow Dialog */}
      <Dialog open={showEditFlowDialog} onOpenChange={setShowEditFlowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Flow</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-flow-name">Flow Name</Label>
              <div className="flex items-center space-x-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                      {React.createElement(editFlowIcon, { className: "h-4 w-4" })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <div className="grid grid-cols-6 gap-2">
                      {iconOptions.map((IconComponent, iconIndex) => (
                        <button
                          key={iconIndex}
                          type="button"
                          onClick={() => setEditFlowIcon(IconComponent)}
                          className={`w-8 h-8 rounded-md border hover:bg-gray-100 flex items-center justify-center transition-colors ${
                            editFlowIcon === IconComponent ? 'bg-blue-100 border-blue-300' : 'border-gray-200'
                          }`}
                        >
                          <IconComponent className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  id="edit-flow-name"
                  value={editFlowName}
                  onChange={(e) => setEditFlowName(e.target.value)}
                  placeholder="Enter flow name"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-flow-description">Description</Label>
              <Textarea
                id="edit-flow-description"
                value={editFlowDescription}
                onChange={(e) => setEditFlowDescription(e.target.value)}
                placeholder="Enter flow description (optional)"
                className="min-h-[80px]"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Pipeline Steps</Label>
              <div className="space-y-3">
                {editFlowSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {/* Color Selector */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-8 h-8 rounded-full border-2 border-gray-200 hover:border-gray-400 transition-colors"
                            style={{ backgroundColor: step.color }}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3">
                          <div className="grid grid-cols-4 gap-2">
                            {colorOptions.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => updateStep(index, 'color', color)}
                                className={`w-8 h-8 rounded-full border-2 hover:scale-105 transition-transform ${
                                  step.color === color ? 'border-gray-400' : 'border-gray-200'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input
                      value={step.name}
                      onChange={(e) => updateStep(index, 'name', e.target.value)}
                      placeholder={`Step ${index + 1}`}
                      className="flex-1"
                    />
                    {editFlowSteps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(index)}
                        className="px-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addStep}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditFlowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFlow}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
