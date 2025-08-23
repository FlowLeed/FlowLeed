
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  BarChart3, 
  Check,
  Calendar, 
  Settings,
  MessageSquare,
  Users,
  Puzzle,
  Plus,
  Settings2,
  X,
  Heart,
  Star,
  Target,
  Zap,
  Shield,
  Globe,
  Briefcase,
  BookOpen,
  Music,
  Coffee,
  Camera,
  Gift,
  Flame,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { calculatePipelineContactCount } from "@/lib/utils";
import { usePipelineContext } from "@/contexts/PipelineContext";
import type { LucideIcon } from "lucide-react";

interface SidebarItem {
  title: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
}

interface FlowStep {
  name: string;
  color: string;
  icon: LucideIcon;
}

interface SidebarSectionProps {
  title: string;
  items: SidebarItem[];
}

const NavItem = ({ item, isActive }: { item: SidebarItem; isActive: boolean }) => {
  return (
    <Link
      to={item.path}
      className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      }`}
    >
      <item.icon className="mr-3 h-5 w-5" />
      <span>{item.title}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
          {item.badge}
        </span>
      )}
    </Link>
  );
};

const SidebarSection: React.FC<SidebarSectionProps> = ({ title, items }) => {
  const location = useLocation();
  const { toast } = useToast();
  const { createPipeline, loading: pipelineLoading } = usePipelineContext();
  const [isConnectedToPC, setIsConnectedToPC] = useState(false);
  const [showCreateFlowDialog, setShowCreateFlowDialog] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [newFlowIcon, setNewFlowIcon] = useState<LucideIcon>(Users);
  const [newFlowSteps, setNewFlowSteps] = useState<FlowStep[]>([
    { name: "New", color: "#3b82f6", icon: Users },
    { name: "In Progress", color: "#f59e0b", icon: Target },
    { name: "Completed", color: "#10b981", icon: Check }
  ]);
  
  // Mock Planning Center lists - in real app, this would come from the API
  const planningCenterLists = [
    { id: '1', name: 'New Members', count: 24 },
    { id: '2', name: 'Volunteers', count: 156 },
    { id: '3', name: 'Small Group Leaders', count: 45 },
    { id: '4', name: 'Youth Ministry', count: 78 },
    { id: '5', name: 'Worship Team', count: 32 }
  ];

  const handleCreateFlow = async (listName: string, listId: string) => {
    try {
      // Create a new pipeline/flow
      const newPipeline = {
        name: listName,
        stages: [
          {
            id: "",
            name: "New",
            contacts: [],
            color: "#3b82f6"
          },
          {
            id: "", 
            name: "Contacted",
            contacts: [],
            color: "#f59e0b"
          },
          {
            id: "",
            name: "Follow Up",
            contacts: [],
            color: "#10b981"
          },
          {
            id: "",
            name: "Completed",
            contacts: [],
            color: "#6366f1"
          }
        ]
      };

      // Create the pipeline in database
      await createPipeline(newPipeline);
      
      toast({
        title: "Flow Created",
        description: `New flow "${listName}" created from Planning Center`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create flow from Planning Center",
        variant: "destructive",
      });
    }
  };

  const handleCreateCustomFlow = async () => {
    console.log("handleCreateCustomFlow called");
    console.log("newFlowName:", newFlowName);
    console.log("newFlowIcon:", newFlowIcon);
    console.log("newFlowSteps:", newFlowSteps);
    
    if (!newFlowName.trim()) {
      console.log("Flow name is empty");
      toast({
        title: "Error",
        description: "Please enter a flow name",
        variant: "destructive",
      });
      return;
    }

    try {
      const newPipeline = {
        name: newFlowName,
        icon: Object.keys(iconMap).find(key => iconMap[key] === newFlowIcon) || 'Users', // Store icon key
        stages: newFlowSteps.map((step) => ({
          id: "", // Will be generated by createPipeline
          name: step.name,
          contacts: [],
          color: step.color
        }))
      };

      // Create the pipeline in database
      await createPipeline(newPipeline);
      
      toast({
        title: "Flow Created",
        description: `New flow "${newFlowName}" created successfully`,
      });

      // Reset form
      setNewFlowName("");
      setNewFlowDescription("");
      setNewFlowIcon(Users);
      setNewFlowSteps([
        { name: "New", color: "#3b82f6", icon: Users },
        { name: "In Progress", color: "#f59e0b", icon: Target },
        { name: "Completed", color: "#10b981", icon: Check }
      ]);
      setShowCreateFlowDialog(false);
    } catch (error) {
      console.error("Error creating custom flow:", error);
      toast({
        title: "Error",
        description: `Failed to create custom flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const addStep = () => {
    const availableColors = ["#3b82f6", "#f59e0b", "#10b981", "#6366f1", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
    const usedColors = newFlowSteps.map(step => step.color);
    const newColor = availableColors.find(color => !usedColors.includes(color)) || "#64748b";
    setNewFlowSteps([...newFlowSteps, { name: "", color: newColor, icon: Users }]);
  };

  const removeStep = (index: number) => {
    if (newFlowSteps.length > 1) {
      setNewFlowSteps(newFlowSteps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, field: 'name' | 'color', value: string) => {
    const updatedSteps = [...newFlowSteps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setNewFlowSteps(updatedSteps);
  };

  const updateStepIcon = (index: number, icon: LucideIcon) => {
    const updatedSteps = [...newFlowSteps];
    updatedSteps[index] = { ...updatedSteps[index], icon };
    setNewFlowSteps(updatedSteps);
  };

  const colorOptions = [
    "#3b82f6", "#f59e0b", "#10b981", "#6366f1", 
    "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"
  ];

  const iconOptions = [
    Users, MessageSquare, Calendar, Settings, Heart, Star, Target, Zap,
    Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift,
    Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3
  ];

  // Create an icon mapping object for easier lookup
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
  
  return (
    <div className="space-y-1">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {title}
        </div>
        {title === "Flows" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-sidebar-accent">
                <Settings2 className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Flows Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
               <DropdownMenuItem 
                onClick={() => setShowCreateFlowDialog(true)}
                disabled={pipelineLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                {pipelineLoading ? "Loading..." : "Create New Flow"}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {isConnectedToPC ? (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Planning Center Lists
                  </DropdownMenuLabel>
                  {planningCenterLists.map((list) => (
                    <DropdownMenuItem 
                      key={list.id}
                      onClick={() => handleCreateFlow(list.name, list.id)}
                      className="flex items-center justify-between"
                    >
                      <span>{list.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {list.count}
                        </Badge>
                        <Plus className="h-3 w-3" />
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsConnectedToPC(false)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Connection
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setIsConnectedToPC(true)}>
                    <Puzzle className="h-4 w-4 mr-2" />
                    Connect Planning Center
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      {/* Create Flow Dialog */}
      <Dialog open={showCreateFlowDialog} onOpenChange={setShowCreateFlowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Flow</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="flow-name">Flow Name</Label>
              <div className="flex items-center space-x-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                      {React.createElement(newFlowIcon, { className: "h-4 w-4" })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <div className="grid grid-cols-6 gap-2">
                      {iconOptions.map((IconComponent, iconIndex) => (
                        <button
                          key={iconIndex}
                          type="button"
                          onClick={() => setNewFlowIcon(IconComponent)}
                          className={`w-8 h-8 rounded-md border hover:bg-gray-100 flex items-center justify-center transition-colors ${
                            newFlowIcon === IconComponent ? 'bg-blue-100 border-blue-300' : 'border-gray-200'
                          }`}
                        >
                          <IconComponent className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  id="flow-name"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  placeholder="Enter flow name"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="flow-description">Description</Label>
              <Textarea
                id="flow-description"
                value={newFlowDescription}
                onChange={(e) => setNewFlowDescription(e.target.value)}
                placeholder="Enter flow description (optional)"
                className="min-h-[80px]"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Pipeline Steps</Label>
              <div className="space-y-3">
                {newFlowSteps.map((step, index) => (
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
                    {newFlowSteps.length > 1 && (
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
            <Button variant="outline" onClick={() => setShowCreateFlowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustomFlow}>
              Create Flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="space-y-1">
        {items.map((item) => (
          <NavItem
            key={item.title}
            item={item}
            isActive={location.pathname === item.path}
          />
        ))}
      </div>
    </div>
  );
};

const Logo = () => (
  <div className="px-4 py-6 flex items-center">
    <img src="/lovable-uploads/55fbe855-f2cf-4756-8840-95900f9d4fbf.png" alt="Flowleed" className="h-8 w-auto" />
  </div>
);

export const Sidebar = () => {
  const { pipelines } = usePipelineContext();

  const iconOptions = [
    Users, MessageSquare, Calendar, Settings, Heart, Star, Target, Zap,
    Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift,
    Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3
  ];

  // Create an icon mapping object for easier lookup
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
  
  const pageItems: SidebarItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
    },
    {
      title: "Analytics",
      icon: BarChart3,
      path: "/analytics",
    },
  ];

  // Create flow items dynamically from all pipelines
  const flowItems: SidebarItem[] = Object.entries(pipelines).map(([key, pipeline]) => {
    // Use stored icon if available, otherwise determine icon based on pipeline name or key
    let icon = Users;
    
    // If pipeline has a stored icon, try to find the matching icon component
    if (pipeline.icon && iconMap[pipeline.icon]) {
      icon = iconMap[pipeline.icon];
    } else {
      // Fallback to name-based icon selection
      if (pipeline.name.toLowerCase().includes('pastoral') || key.includes('pastoral')) {
        icon = MessageSquare;
      } else if (pipeline.name.toLowerCase().includes('operation') || key.includes('operation')) {
        icon = Calendar;
      } else if (pipeline.name.toLowerCase().includes('host') || key.includes('host')) {
        icon = Users;
      }
    }

    return {
      title: pipeline.name,
      icon,
      path: `/pipelines/${key}`,
      badge: calculatePipelineContactCount(pipeline),
    };
  });

  const settingsItems: SidebarItem[] = [
    {
      title: "My Profile",
      icon: Settings,
      path: "/profile",
    },
    {
      title: "Integrations",
      icon: Puzzle,
      path: "/integrations",
    },
  ];

  return (
    <div className="h-screen w-64 border-r border-sidebar-border bg-sidebar-background flex flex-col">
      <Logo />
      <div className="flex-1 overflow-auto py-2 space-y-6">
        <SidebarSection title="Pages" items={pageItems} />
        <SidebarSection title="Flows" items={flowItems} />
        <SidebarSection title="Settings" items={settingsItems} />
      </div>
    </div>
  );
};
