import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileSidebar } from "@/contexts/MobileSidebarContext";
import { LayoutDashboard, BarChart3, Check, Calendar, Settings, MessageSquare, Phone, Users, UsersRound, Puzzle, Plus, Settings2, X, GripVertical, Flag, FlagTriangleRight, Target, Heart, CheckSquare, RefreshCw, Star, User, Filter as FilterIcon, Check as CheckIcon, Activity, Sparkles, Film, HandHeart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenuCheckboxItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { useIsOrgAdmin } from "@/hooks/useIsOrgAdmin";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useFlowTeamMemberships } from "@/hooks/useFlowTeamMemberships";
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
import { useAuth } from "@/hooks/useAuth";
import { useMyFlows } from "@/hooks/useMyFlows";
import { useFlowPreferences } from "@/hooks/useFlowPreferences";
import { useOrgFeatures } from "@/hooks/useOrgFeatures";
import type { LucideIcon } from "lucide-react";
interface SidebarItem {
  title: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
  comingSoon?: boolean;
  beta?: boolean;
  flow_type?: 'linear' | 'recurring';
  cycle_days?: number;
  flowId?: string;
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
  pinnedFlowIds?: Set<string>;
  onPin?: (flowId: string) => void;
  filterControl?: React.ReactNode;
  footerControl?: React.ReactNode;
}
const NavItem = ({
  item,
  isActive,
  isPinned,
  onPin,
}: {
  item: SidebarItem;
  isActive: boolean;
  isPinned?: boolean;
  onPin?: (flowId: string) => void;
}) => {
  if (item.comingSoon) {
    return (
      <div className="flex min-h-11 md:min-h-9 w-full items-center gap-3 rounded-full px-4 py-2 md:py-1 text-sm font-medium opacity-50 cursor-not-allowed min-w-0">
        <item.icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <span className="font-extralight truncate whitespace-nowrap min-w-0">{item.title}</span>
        <Badge variant="secondary" className="ml-auto text-xs">Coming Soon</Badge>
      </div>
    );
  }
  
  return <div className="group flex items-center">
    <Link to={item.path} className={`flex min-h-11 md:min-h-9 flex-1 items-center gap-3 py-2 md:py-1 rounded-full text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"} min-w-0 px-[10px]`}>
      <div className="relative flex-shrink-0">
        <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-sidebar-foreground"}`} />
        {item.flow_type === 'recurring' && (
          <span className="absolute -top-0.5 -right-0.5 bg-green-500 text-white rounded-full p-0.5">
            <RefreshCw className="h-2 w-2" />
          </span>
        )}
      </div>
      <span className="font-extralight truncate whitespace-nowrap min-w-0 flex-1">
        {item.title}
      </span>
      {item.beta && (
        <Badge
          variant="outline"
          className={`ml-auto text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${isActive ? "border-white/60 text-white" : "border-purple-500/50 text-purple-500"}`}
        >
          Beta
        </Badge>
      )}
      {item.badge != null && item.badge > 0 && <span className={`ml-auto text-xs rounded-full px-2 py-0.5 flex-shrink-0 ${isActive ? "bg-white text-purple-500" : "bg-purple-500 text-white"}`}>
          {item.badge}
        </span>}
    </Link>
    {onPin && item.flowId && (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPin(item.flowId!); }}
        className={`flex-shrink-0 p-1 rounded-full transition-all ${isPinned ? 'opacity-100 text-muted-foreground' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground'}`}
        title={isPinned ? "Unpin flow" : "Pin flow"}
      >
        <Star className={`h-3.5 w-3.5 transition-all ${isPinned ? '' : 'group-hover:fill-muted-foreground'}`} />
      </button>
    )}
  </div>;
};
const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  items,
  onSettingsClick,
  pinnedFlowIds,
  onPin,
  filterControl,
  footerControl,
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
      <div className="px-4 py-1.5 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {title}
        </div>
        {title === "Flows" && (
          <div className="flex items-center gap-0.5">
            {filterControl}
            {onSettingsClick && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-sidebar-accent" onClick={onSettingsClick}>
                <Settings2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
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
      
      
      <div className="space-y-0.5">
        {items.map(item => {
          const isActive = item.path === "/"
            ? location.pathname === "/"
            : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return <NavItem key={item.flowId ?? item.path ?? item.title} item={item} isActive={isActive} isPinned={pinnedFlowIds?.has(item.flowId || '')} onPin={title === "Flows" ? onPin : undefined} />;
        })}
      </div>
      {footerControl}
      
    </div>;
};
import flowleedLogo from "@/assets/flowleed_logo_new.png";
const Logo = () => <div className="px-8 py-6 flex items-center">
    <img src={flowleedLogo} alt="Flowleed" className="h-5 w-auto" />
  </div>;
export const Sidebar = () => {
  const {
    flows
  } = useFlowContext();
  const { user } = useAuth();
  const location = useLocation();
  const { data: myFlows } = useMyFlows(user?.id);
  const { pinnedFlowIds, togglePin } = useFlowPreferences(user?.id);
  const [showFlowsManagement, setShowFlowsManagement] = useState(false);
  const STORAGE_KEY = user?.id ? `flow-filters:${user.id}` : null;
  const initialFilters = (() => {
    if (typeof window === "undefined" || !STORAGE_KEY) return { showAllFlows: false, showPinnedOnly: false, teamMemberFilter: null as string | null };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { showAllFlows: false, showPinnedOnly: false, teamMemberFilter: null as string | null };
      const parsed = JSON.parse(raw);
      return {
        showAllFlows: !!parsed.showAllFlows,
        showPinnedOnly: !!parsed.showPinnedOnly,
        teamMemberFilter: parsed.teamMemberFilter ?? null,
      };
    } catch {
      return { showAllFlows: false, showPinnedOnly: false, teamMemberFilter: null as string | null };
    }
  })();
  const [showAllFlows, setShowAllFlows] = useState(initialFilters.showAllFlows);
  const [showPinnedOnly, setShowPinnedOnly] = useState(initialFilters.showPinnedOnly);
  const [teamMemberFilter, setTeamMemberFilter] = useState<string | null>(initialFilters.teamMemberFilter);

  const { isOrgAdmin } = useIsOrgAdmin(user?.id);
  const { data: orgMembers = [] } = useOrgMembers(user?.id, isOrgAdmin);
  const { data: flowsByMember } = useFlowTeamMemberships(isOrgAdmin && !!teamMemberFilter);
  const { isEnabled: isFeatureEnabled } = useOrgFeatures();

  // Persist filter selections per user
  useEffect(() => {
    if (!STORAGE_KEY || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ showAllFlows, showPinnedOnly, teamMemberFilter })
      );
    } catch {}
  }, [STORAGE_KEY, showAllFlows, showPinnedOnly, teamMemberFilter]);
  
  const aiEnabled = isFeatureEnabled("flowleed_ai");
  const hubItems: SidebarItem[] = ([{
    title: "People",
    icon: Users,
    path: "/contacts"
  }, {
    title: "Signals",
    icon: Activity,
    path: "/signals",
    beta: true,
    featureKey: "signals" as const,
  }, {
    title: "Analytics",
    icon: BarChart3,
    path: "/analytics"
  }, {
    title: "Groups",
    icon: UsersRound,
    path: "/groups"
  }, {
    title: "Tasks",
    icon: CheckSquare,
    path: "/tasks"
  }, {
    title: "Prayer",
    icon: HandHeart,
    path: "/prayer"
  }] as (SidebarItem & { featureKey?: "flowleed_ai" | "signals" })[])
    .filter(item => !item.featureKey || isFeatureEnabled(item.featureKey));



  // Create flow items dynamically from all flows (database data), sorted by flow_order
  const allFlowItems: SidebarItem[] = Object.entries(flows).map(([key, flow]) => ({
    flow,
    key
  })).sort((a, b) => (a.flow.flow_order || 0) - (b.flow.flow_order || 0)).map(({
    flow
  }) => {
    let icon = Users;
    if (flow.icon && iconMap[flow.icon]) {
      icon = iconMap[flow.icon];
    } else {
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
      badge: calculateFlowContactCount(flow),
      flow_type: flow.flow_type,
      cycle_days: flow.cycle_days,
      flowId: flow.id,
    };
  });

  // Build my flow IDs set from useMyFlows data
  const myFlowIds = new Set<string>(myFlows?.map((f: any) => f.id).filter(Boolean) || []);

  // Keep the everyday Flow list compact. Favorites appear first, while the
  // current Flow is always retained so navigation never loses context.
  let displayedFlowItems: SidebarItem[];
  if (showAllFlows) {
    displayedFlowItems = allFlowItems;
  } else {
    const preferredFlowItems = allFlowItems.filter(item =>
      (item.flowId && myFlowIds.has(item.flowId)) ||
      (item.flowId && pinnedFlowIds.has(item.flowId))
    );
    const compactCandidates = preferredFlowItems.length > 0 ? preferredFlowItems : allFlowItems;
    const pinnedFirst = [...compactCandidates].sort((a, b) =>
      Number(!!b.flowId && pinnedFlowIds.has(b.flowId)) - Number(!!a.flowId && pinnedFlowIds.has(a.flowId))
    );
    displayedFlowItems = pinnedFirst.slice(0, 6);
    const activeFlow = allFlowItems.find(item => item.path === location.pathname);
    if (activeFlow && !displayedFlowItems.some(item => item.flowId === activeFlow.flowId)) {
      displayedFlowItems = [...displayedFlowItems.slice(0, 5), activeFlow];
    }
  }
  if (showPinnedOnly) {
    displayedFlowItems = displayedFlowItems.filter(item => item.flowId && pinnedFlowIds.has(item.flowId));
  }
  if (isOrgAdmin && teamMemberFilter && flowsByMember) {
    const memberFlows = flowsByMember.get(teamMemberFilter) ?? new Set<string>();
    displayedFlowItems = displayedFlowItems.filter(item => item.flowId && memberFlows.has(item.flowId));
  }
  const filtersActive = showPinnedOnly || !!teamMemberFilter;
  
  // Calculate total unread messages
  const totalUnreadMessages = mockConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  
  const marketingItems: SidebarItem[] = ([{
    title: "Content & Stories",
    icon: Film,
    path: "/content",
    beta: true,
    featureKey: "content" as const,
  }, {
    title: "Forms",
    icon: CheckSquare,
    path: "/forms",
    beta: true,
    featureKey: "forms" as const,
  }, {
    title: "Messages",
    icon: MessageSquare,
    path: "/messages",
    comingSoon: true,
    featureKey: "texting" as const,
  }, {
    title: "Calls",
    icon: Phone,
    path: "/calls",
    comingSoon: true,
    featureKey: "calling" as const,
  }] as (SidebarItem & { featureKey?: "texting" | "calling" | "content" | "forms" })[])
    .filter(item => !item.featureKey || isFeatureEnabled(item.featureKey));

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

  const isMobile = useIsMobile();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileSidebar();

  // Auto-close mobile sheet on route change
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const selectedMember = teamMemberFilter ? orgMembers.find(m => m.user_id === teamMemberFilter) : null;
  const flowsFilterControl = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-sidebar-accent relative" title="Filter flows">
          <FilterIcon className="h-3 w-3" />
          {filtersActive && (
            <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-purple-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={showPinnedOnly} onCheckedChange={(c) => setShowPinnedOnly(!!c)}>
          <Star className="h-3.5 w-3.5 mr-2" />
          Favorites only
        </DropdownMenuCheckboxItem>
        {isOrgAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Team member</DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="truncate">{selectedMember ? selectedMember.full_name : "Anyone"}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="max-h-72 overflow-y-auto bg-popover z-50">
                  <DropdownMenuItem onClick={() => setTeamMemberFilter(null)}>
                    <span className="w-4 mr-2 inline-flex justify-center">
                      {!teamMemberFilter && <CheckIcon className="h-3.5 w-3.5" />}
                    </span>
                    Anyone
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {orgMembers.map((m) => (
                    <DropdownMenuItem key={m.user_id} onClick={() => setTeamMemberFilter(m.user_id)}>
                      <span className="w-4 mr-2 inline-flex justify-center">
                        {teamMemberFilter === m.user_id && <CheckIcon className="h-3.5 w-3.5" />}
                      </span>
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={m.avatar_url ?? undefined} alt={m.full_name} />
                        <AvatarFallback className="text-[10px]">
                          {m.full_name.split(" ").map(p => p[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.full_name}</span>
                    </DropdownMenuItem>
                  ))}
                  {orgMembers.length === 0 && (
                    <DropdownMenuItem disabled>No teammates</DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const flowsToggleControl = allFlowItems.length > 6 ? (
    <Button
      variant="ghost"
      size="sm"
      className="mt-1 h-9 w-full justify-start px-[10px] text-xs font-normal text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      onClick={() => setShowAllFlows(current => !current)}
    >
      {showAllFlows ? "Show fewer" : `Show all ${allFlowItems.length}`}
    </Button>
  ) : null;

  const aiActive = location.pathname === "/";
  const aiLink = aiEnabled ? (
    <Link
      to="/"
      className={`flex min-h-11 md:min-h-9 items-center gap-3 rounded-full px-[10px] py-2 md:py-1 text-sm transition-colors ${aiActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
    >
      <Sparkles className="h-5 w-5" />
      <span className="font-extralight">FlowLeed AI</span>
    </Link>
  ) : null;

  const flowsSection = (
    <SidebarSection
      title="Flows"
      items={displayedFlowItems}
      onSettingsClick={() => setShowFlowsManagement(true)}
      pinnedFlowIds={pinnedFlowIds}
      onPin={togglePin}
      filterControl={flowsFilterControl}
      footerControl={flowsToggleControl}
    />
  );

  const sidebarContent = (
    <>
      <Logo />
      <div className="flex-1 overflow-auto py-2 px-4 space-y-4 sidebar-scroll">
        {aiLink}
        <SidebarSection title="HUB" items={hubItems} />
        {flowsSection}
        {marketingItems.length > 0 && <SidebarSection title="Marketing" items={marketingItems} />}
        <SidebarSection title="Settings" items={settingsItems} />
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-[min(280px,84vw)] flex-col bg-sidebar p-0">
            {sidebarContent}
          </SheetContent>
        </Sheet>
        <FlowsManagementDialog open={showFlowsManagement} onOpenChange={setShowFlowsManagement} />
      </>
    );
  }

  return (
    <DesktopRail
      aiLink={aiEnabled}
      aiActive={aiActive}
      hubItems={hubItems}
      marketingItems={marketingItems}
      settingsItems={settingsItems}
      flowsSection={flowsSection}
      flowsBadge={allFlowItems.length}
      pathname={location.pathname}
      flowsManagement={<FlowsManagementDialog open={showFlowsManagement} onOpenChange={setShowFlowsManagement} />}
    />
  );
};

type RailSection = "hub" | "flows" | "marketing" | "settings";
const RAIL_WIDTH = 56;
const DRAWER_WIDTH = 240;
const DRAWER_KEY = "flowleed-nav-drawer";

const DesktopRail = ({
  aiLink, aiActive, hubItems, marketingItems, settingsItems, flowsSection, flowsBadge, pathname, flowsManagement,
}: {
  aiLink: boolean; aiActive: boolean; hubItems: SidebarItem[]; marketingItems: SidebarItem[]; settingsItems: SidebarItem[];
  flowsSection: React.ReactNode; flowsBadge: number; pathname: string; flowsManagement: React.ReactNode;
}) => {
  const matches = (items: SidebarItem[]) => items.some(i => pathname === i.path || pathname.startsWith(`${i.path}/`));
  const routeSection: RailSection = pathname.startsWith("/flows") ? "flows"
    : matches(marketingItems) ? "marketing"
    : matches(settingsItems) ? "settings" : "hub";

  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(DRAWER_KEY) !== "closed"; } catch { return true; }
  });
  const [section, setSection] = useState<RailSection>(routeSection);

  useEffect(() => { setSection(routeSection); }, [routeSection]);
  useEffect(() => {
    try { localStorage.setItem(DRAWER_KEY, open ? "open" : "closed"); } catch {}
    const width = RAIL_WIDTH + (open ? DRAWER_WIDTH : 0);
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  }, [open]);

  const choose = (s: RailSection) => {
    if (open && section === s) setOpen(false);
    else { setSection(s); setOpen(true); }
  };

  const railButton = (s: RailSection, Icon: LucideIcon, label: string, badge?: number) => {
    const active = section === s && open;
    const current = routeSection === s && !aiActive;
    return (
      <button
        key={s}
        type="button"
        onClick={() => choose(s)}
        title={label}
        aria-label={label}
        aria-expanded={active}
        className={`relative flex h-11 w-11 flex-col items-center justify-center rounded-xl transition-colors ${active ? "bg-sidebar-accent text-sidebar-foreground" : current ? "text-primary hover:bg-sidebar-accent/50" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}
      >
        <Icon className="h-5 w-5" />
        <span className="mt-0.5 text-[9px] leading-none">{label}</span>
        {badge ? <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 text-[9px] leading-4 text-primary-foreground">{badge}</span> : null}
      </button>
    );
  };

  const titles: Record<RailSection, string> = { hub: "HUB", flows: "Flows", marketing: "Marketing", settings: "Settings" };

  return (
    <>
      <div className="flex h-full flex-shrink-0" style={{ width: `var(--sidebar-width)` }}>
        <nav className="flex h-full w-14 flex-shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3">
          <img src={flowleedLogo} alt="FlowLeed" className="mb-2 h-6 w-6 object-cover object-left" />
          {aiLink && (
            <Link
              to="/"
              title="FlowLeed AI"
              aria-label="FlowLeed AI"
              className={`mb-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors ${aiActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
            >
              <Sparkles className="h-5 w-5" />
            </Link>
          )}
          <div className="my-1 h-px w-8 bg-sidebar-border" />
          {railButton("hub", LayoutDashboard, "Hub")}
          {railButton("flows", RefreshCw, "Flows", flowsBadge)}
          {marketingItems.length > 0 && railButton("marketing", Film, "Market")}
          <div className="mt-auto" />
          {railButton("settings", Settings, "Settings")}
        </nav>
        {open && (
          <div className="flex h-full min-w-0 flex-1 flex-col bg-sidebar animate-in slide-in-from-left-2 duration-200">
            <div className="flex items-center justify-end px-3 pt-3">
              <span className="sr-only">{titles[section]}</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setOpen(false)} title="Collapse menu" aria-label="Collapse menu">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto px-3 py-2 sidebar-scroll">
              {section === "hub" && <SidebarSection title="HUB" items={hubItems} />}
              {section === "flows" && flowsSection}
              {section === "marketing" && <SidebarSection title="Marketing" items={marketingItems} />}
              {section === "settings" && <SidebarSection title="Settings" items={settingsItems} />}
            </div>
          </div>
        )}
      </div>
      {flowsManagement}
    </>
  );
};