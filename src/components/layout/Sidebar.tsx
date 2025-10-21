import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, BarChart3, Check, Calendar, Settings, MessageSquare, Users, Puzzle, Plus, Settings2, X, GripVertical, Flag, FlagTriangleRight, Target, Heart, CheckSquare } from "lucide-react";
import { iconMap, iconOptions } from "@/lib/flowIcons";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { calculateFlowContactCount } from "@/lib/utils";
import { useFlowContext } from "@/contexts/FlowContext";
import { FlowsManagementDialog } from "@/components/flows/FlowsManagementDialog";
import { mockConversations } from "@/data/mockMessages";
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
  isStartStep?: boolean;
  isEndStep?: boolean;
}
interface SidebarSectionProps {
  title: string;
  items: SidebarItem[];
  onSettingsClick?: () => void;
}
const NavItem = ({
  item,
  isActive
}: {
  item: SidebarItem;
  isActive: boolean;
}) => {
  return <Link to={item.path} className={`flex items-center px-8 py-2 rounded-full text-sm font-medium transition-colors ${isActive ? "bg-purple-500 text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
      <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? "text-white" : "text-purple-500"}`} />
      <span className="font-extralight truncate">{item.title}</span>
      {item.badge != null && item.badge > 0 && <span className={`ml-auto text-xs rounded-full px-2 py-0.5 ${isActive ? "bg-white text-purple-500" : "bg-purple-500 text-white"}`}>
          {item.badge}
        </span>}
    </Link>;
};
const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  items,
  onSettingsClick
}) => {
  const location = useLocation();
  const {
    toast
  } = useToast();
  const {
    createFlow,
    loading: flowLoading
  } = useFlowContext();
  const [isConnectedToPC, setIsConnectedToPC] = useState(false);
  const [showCreateFlowDialog, setShowCreateFlowDialog] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [newFlowIcon, setNewFlowIcon] = useState<LucideIcon>(Users);
  const [newFlowSteps, setNewFlowSteps] = useState<FlowStep[]>([{
    name: "New",
    color: "#3b82f6",
    icon: Users,
    isStartStep: true,
    isEndStep: false
  }, {
    name: "In Progress",
    color: "#f59e0b",
    icon: Target,
    isStartStep: false,
    isEndStep: false
  }, {
    name: "Completed",
    color: "#10b981",
    icon: Check,
    isStartStep: false,
    isEndStep: true
  }]);

  // Mock Planning Center lists - in real app, this would come from the API
  const planningCenterLists = [{
    id: '1',
    name: 'New Members',
    count: 24
  }, {
    id: '2',
    name: 'Volunteers',
    count: 156
  }, {
    id: '3',
    name: 'Small Group Leaders',
    count: 45
  }, {
    id: '4',
    name: 'Youth Ministry',
    count: 78
  }, {
    id: '5',
    name: 'Worship Team',
    count: 32
  }];
  const handleCreateFlow = async (listName: string, listId: string) => {
    try {
      // Create a new pipeline/flow
      const newPipeline = {
        name: listName,
        stages: [{
          id: "",
          name: "New",
          contacts: [],
          color: "#3b82f6"
        }, {
          id: "",
          name: "Contacted",
          contacts: [],
          color: "#f59e0b"
        }, {
          id: "",
          name: "Follow Up",
          contacts: [],
          color: "#10b981"
        }, {
          id: "",
          name: "Completed",
          contacts: [],
          color: "#6366f1"
        }]
      };

      // Create the flow in database
      await createFlow(newPipeline);
      toast({
        title: "Flow Created",
        description: `New flow "${listName}" created from Planning Center`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create flow from Planning Center",
        variant: "destructive"
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
        variant: "destructive"
      });
      return;
    }
    try {
      const newPipeline = {
        name: newFlowName,
        icon: Object.keys(iconMap).find(key => iconMap[key] === newFlowIcon) || 'Users',
        // Store icon key
        stages: newFlowSteps.map((step, index) => ({
          id: "",
          // Will be generated by createPipeline
          name: step.name,
          contacts: [],
          color: step.color,
          isStartStep: step.isStartStep || false,
          isEndStep: step.isEndStep || false
        }))
      };

      // Create the flow in database
      await createFlow(newPipeline);
      toast({
        title: "Flow Created",
        description: `New flow "${newFlowName}" created successfully`
      });

      // Reset form
      setNewFlowName("");
      setNewFlowDescription("");
      setNewFlowIcon(Users);
      setNewFlowSteps([{
        name: "New",
        color: "#3b82f6",
        icon: Users,
        isStartStep: true,
        isEndStep: false
      }, {
        name: "In Progress",
        color: "#f59e0b",
        icon: Target,
        isStartStep: false,
        isEndStep: false
      }, {
        name: "Completed",
        color: "#10b981",
        icon: Check,
        isStartStep: false,
        isEndStep: true
      }]);
      setShowCreateFlowDialog(false);
    } catch (error) {
      console.error("Error creating custom flow:", error);
      toast({
        title: "Error",
        description: `Failed to create custom flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };
  const addStep = () => {
    const availableColors = ["#3b82f6", "#f59e0b", "#10b981", "#6366f1", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
    const usedColors = newFlowSteps.map(step => step.color);
    const newColor = availableColors.find(color => !usedColors.includes(color)) || "#64748b";
    setNewFlowSteps([...newFlowSteps, {
      name: "",
      color: newColor,
      icon: Users,
      isStartStep: false,
      isEndStep: false
    }]);
  };
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(newFlowSteps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setNewFlowSteps(items);
  };
  const markAsStartStep = (index: number) => {
    const updated = newFlowSteps.map((step, i) => ({
      ...step,
      isStartStep: i === index,
      isEndStep: i === index ? false : step.isEndStep // Clear end if marking as start
    }));
    setNewFlowSteps(updated);
  };
  const markAsEndStep = (index: number) => {
    const updated = newFlowSteps.map((step, i) => ({
      ...step,
      isEndStep: i === index,
      isStartStep: i === index ? false : step.isStartStep // Clear start if marking as end
    }));
    setNewFlowSteps(updated);
  };
  const removeStep = (index: number) => {
    if (newFlowSteps.length > 1) {
      setNewFlowSteps(newFlowSteps.filter((_, i) => i !== index));
    }
  };
  const updateStep = (index: number, field: 'name' | 'color', value: string) => {
    const updatedSteps = [...newFlowSteps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      [field]: value
    };
    setNewFlowSteps(updatedSteps);
  };
  const updateStepIcon = (index: number, icon: LucideIcon) => {
    const updatedSteps = [...newFlowSteps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      icon
    };
    setNewFlowSteps(updatedSteps);
  };
  const colorOptions = ["#3b82f6", "#f59e0b", "#10b981", "#6366f1", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
  return <div className="space-y-1">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {title}
        </div>
        {title === "Flows" && onSettingsClick && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-sidebar-accent" onClick={onSettingsClick}>
            <Settings2 className="h-3 w-3" />
          </Button>}
      </div>
      
      {/* Create Flow Dialog */}
      <Dialog open={showCreateFlowDialog} onOpenChange={setShowCreateFlowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Flow</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="flow-name">Flow Name</Label>
                <div className="flex items-center space-x-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="shrink-0">
                        {React.createElement(newFlowIcon, {
                      className: "h-4 w-4"
                    })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3">
                      <div className="grid grid-cols-6 gap-2">
                        {iconOptions.map((iconOption, iconIndex) => <button key={iconIndex} type="button" onClick={() => setNewFlowIcon(iconOption.icon)} className={`w-8 h-8 rounded-md border hover:bg-gray-100 flex items-center justify-center transition-colors ${newFlowIcon === iconOption.icon ? 'bg-blue-100 border-blue-300' : 'border-gray-200'}`}>
                            <iconOption.icon className="h-4 w-4" />
                          </button>)}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input id="flow-name" value={newFlowName} onChange={e => setNewFlowName(e.target.value)} placeholder="Enter flow name" className="flex-1" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="flow-description">Description</Label>
                <Textarea id="flow-description" value={newFlowDescription} onChange={e => setNewFlowDescription(e.target.value)} placeholder="Enter flow description (optional)" className="min-h-[80px]" />
              </div>
              
              <div className="space-y-2">
                <Label>Pipeline Steps</Label>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="flow-steps">
                    {provided => <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                        {newFlowSteps.map((step, index) => <Draggable key={index} draggableId={`step-${index}`} index={index}>
                            {provided => <div ref={provided.innerRef} {...provided.draggableProps} className="flex items-center gap-3 bg-background border rounded-lg p-3">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {/* Color Selector */}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button type="button" className="w-8 h-8 rounded-full border-2 border-gray-200 hover:border-gray-400 transition-colors" style={{
                              backgroundColor: step.color
                            }} />
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-3">
                                      <div className="grid grid-cols-4 gap-2">
                                        {colorOptions.map(color => <button key={color} type="button" onClick={() => updateStep(index, 'color', color)} className={`w-8 h-8 rounded-full border-2 hover:scale-105 transition-transform ${step.color === color ? 'border-gray-400' : 'border-gray-200'}`} style={{
                                backgroundColor: color
                              }} />)}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>

                                <Input value={step.name} onChange={e => updateStep(index, 'name', e.target.value)} placeholder={`Step ${index + 1}`} className="flex-1" />

                                {/* Start/End Markers */}
                                <div className="flex items-center gap-1">
                                  <Button variant={step.isStartStep ? "default" : "outline"} size="sm" onClick={() => markAsStartStep(index)} className="h-8 px-2" title="Mark as start step">
                                    <Flag className="h-3 w-3 mr-1" />
                                    Start
                                  </Button>
                                  <Button variant={step.isEndStep ? "default" : "outline"} size="sm" onClick={() => markAsEndStep(index)} className="h-8 px-2" title="Mark as end step">
                                    <FlagTriangleRight className="h-3 w-3 mr-1" />
                                    End
                                  </Button>
                                </div>

                                {newFlowSteps.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeStep(index)} className="px-2">
                                    <X className="h-4 w-4" />
                                  </Button>}
                              </div>}
                          </Draggable>)}
                        {provided.placeholder}
                      </div>}
                  </Droppable>
                </DragDropContext>
                <Button variant="outline" size="sm" onClick={addStep} className="w-full mt-3">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
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
        {items.map(item => <NavItem key={item.title} item={item} isActive={location.pathname === item.path} />)}
      </div>
    </div>;
};
import flowleedLogo from "@/assets/flowleed_logo.png";
const Logo = () => <div className="px-8 py-6 flex items-center">
    <img src={flowleedLogo} alt="Flowleed" className="h-5 w-auto" />
  </div>;
export const Sidebar = () => {
  const {
    flows
  } = useFlowContext();
  const [showFlowsManagement, setShowFlowsManagement] = useState(false);
  const pageItems: SidebarItem[] = [{
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/"
  }, {
    title: "People",
    icon: Users,
    path: "/contacts"
  }, {
    title: "Analytics",
    icon: BarChart3,
    path: "/analytics"
  }, {
    title: "Tasks",
    icon: CheckSquare,
    path: "/tasks"
  }];

  // Create flow items dynamically from all flows (database data), sorted by flow_order
  const flowItems: SidebarItem[] = Object.entries(flows).map(([key, flow]) => ({
    flow,
    key
  })).sort((a, b) => (a.flow.flow_order || 0) - (b.flow.flow_order || 0)).map(({
    flow
  }) => {
    // Use stored icon if available, otherwise determine icon based on flow name
    let icon = Users;

    // If flow has a stored icon, try to find the matching icon component
    if (flow.icon && iconMap[flow.icon]) {
      icon = iconMap[flow.icon];
    } else {
      // Fallback to name-based icon selection for existing flows
      const name = flow.name.toLowerCase();
      if (name.includes('pastoral') || name.includes('care')) {
        icon = MessageSquare;
      } else if (name.includes('operation') || name.includes('ops')) {
        icon = Calendar;
      } else if (name.includes('host') || name.includes('team')) {
        icon = Users;
      } else if (name.includes('giving') || name.includes('hub')) {
        icon = Heart;
      }
    }
    return {
      title: flow.name,
      icon,
      path: `/flows/${flow.id}`,
      // Use flow.id instead of key for database flows
      badge: calculateFlowContactCount(flow)
    };
  });
  
  // Calculate total unread messages
  const totalUnreadMessages = mockConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  
  const connectItems: SidebarItem[] = [{
    title: "Messages",
    icon: MessageSquare,
    path: "/messages",
    badge: totalUnreadMessages
  }, {
    title: "Calendar",
    icon: Calendar,
    path: "/calendar"
  }];

  const settingsItems: SidebarItem[] = [{
    title: "My Profile",
    icon: Settings,
    path: "/profile"
  }, {
    title: "My Organization",
    icon: Users,
    path: "/team"
  }, {
    title: "Integrations",
    icon: Puzzle,
    path: "/integrations"
  }];
  return <>
      <div className="h-screen w-80 flex flex-col">
        <Logo />
        <div className="flex-1 overflow-auto py-2 px-4 space-y-6">
          <SidebarSection title="HUB" items={pageItems} />
          <SidebarSection title="Flows" items={flowItems} onSettingsClick={() => setShowFlowsManagement(true)} />
          <SidebarSection title="Connect" items={connectItems} />
          <SidebarSection title="Settings" items={settingsItems} />
        </div>
      </div>
      
      <FlowsManagementDialog open={showFlowsManagement} onOpenChange={setShowFlowsManagement} />
    </>;
};