
import React, { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Plus, Search, LogOut, User, Settings, Workflow, Settings2, X, Trash2, GripVertical, LayoutGrid, Table2, Users, MessageSquare, Calendar, Heart, CheckSquare, SquareCheck, ArrowLeft, BookOpen, BarChart3, RotateCcw, RefreshCw, Menu, MoreHorizontal } from "lucide-react";
import { useMobileSidebar } from "@/contexts/MobileSidebarContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { iconMap, iconOptions } from "@/lib/flowIcons";
import { FlowHeaderFilters } from "@/components/crm/FlowHeaderFilters";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useFlowContext } from "@/contexts/FlowContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import type { LucideIcon } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  email: string;
}

interface HeaderProps {
  title: string;
  titleBadge?: React.ReactNode;
  description?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  showFlowIcon?: boolean;
  rightContent?: React.ReactNode;
  showAddButton?: boolean;
  onAddClick?: () => void;
  onSettingsClick?: () => void;
  addButtonLabel?: string;
  teamMembers?: TeamMember[];
  selectedFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
  contactCounts?: {
    all: number;
    unassigned: number;
    byMember: Record<string, number>;
  };
  showCompleted?: boolean;
  onShowCompletedChange?: (show: boolean) => void;
  completedCount?: number;
  viewMode?: 'kanban' | 'table';
  onViewModeChange?: (mode: 'kanban' | 'table') => void;
  isSelectMode?: boolean;
  onToggleSelectMode?: () => void;
  onSelectAll?: () => void;
  onDocsClick?: () => void;
  onAnalyticsClick?: () => void;
  flowType?: 'linear' | 'recurring';
  cycleDays?: number;
  selectedEngagementFilter?: string | null;
  onEngagementFilterChange?: (level: string | null) => void;
  selectedCampusFilter?: string | null;
  onCampusFilterChange?: (campusId: string | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  titleBadge,
  description,
  showBackButton = false,
  onBackClick,
  showFlowIcon = false,
  rightContent,
  showAddButton = true,
  onAddClick,
  onSettingsClick,
  addButtonLabel = "New Person",
  teamMembers = [],
  selectedFilter = null,
  onFilterChange,
  contactCounts,
  showCompleted = false,
  onShowCompletedChange,
  completedCount = 0,
  viewMode,
  onViewModeChange,
  isSelectMode = false,
  onToggleSelectMode,
  onSelectAll,
  onDocsClick,
  onAnalyticsClick,
  flowType,
  cycleDays,
  selectedEngagementFilter,
  onEngagementFilterChange,
  selectedCampusFilter,
  onCampusFilterChange
}) => {
  const { user, signOut } = useAuth();
  const { profile, organization } = useProfile();
  const { flows, updateFlow, deleteFlow } = useFlowContext();
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Edit flow dialog state
  const [showEditFlowDialog, setShowEditFlowDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [editFlowName, setEditFlowName] = useState("");
  const [editFlowDescription, setEditFlowDescription] = useState("");
  const [editFlowIcon, setEditFlowIcon] = useState<LucideIcon>(Users);

  // Global search keyboard shortcut
  useGlobalSearch({ 
    onToggle: () => setShowGlobalSearch(prev => !prev) 
  });
  const [editFlowSteps, setEditFlowSteps] = useState<Array<{id: string, name: string, color: string}>>([]);

  // Get the current flow and its icon
  const currentFlow = flowId ? Object.values(flows).find(f => f.id === flowId) : null;
  let FlowIcon = Workflow; // Default fallback

  if (currentFlow?.icon && iconMap[currentFlow.icon]) {
    FlowIcon = iconMap[currentFlow.icon];
  } else if (currentFlow) {
    // Fallback to name-based icon selection
    const name = currentFlow.name.toLowerCase();
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

  const colorOptions = [
    "#3b82f6", "#f59e0b", "#10b981", "#6366f1", 
    "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"
  ];

  const openEditDialog = () => {
    if (currentFlow) {
      setEditFlowName(currentFlow.name);
      setEditFlowDescription(currentFlow.description || "");
      
      // Set icon
      if (currentFlow.icon && iconMap[currentFlow.icon]) {
        setEditFlowIcon(iconMap[currentFlow.icon]);
      } else {
        setEditFlowIcon(FlowIcon);
      }
      
      // Set steps from current flow stages
      setEditFlowSteps(currentFlow.stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        color: stage.color || "#3b82f6"
      })));
      
      setShowEditFlowDialog(true);
    }
  };

  const handleSaveFlow = async () => {
    if (!currentFlow || !editFlowName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a flow name",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedFlow = {
        ...currentFlow,
        name: editFlowName,
        description: editFlowDescription,
        icon: Object.keys(iconMap).find(key => iconMap[key] === editFlowIcon) || 'Users',
        stages: editFlowSteps.map((step, index) => {
          // For existing steps, keep the original structure
          if (step.id && step.id !== "") {
            return {
              id: step.id,
              name: step.name,
              color: step.color,
              stage_order: index, // Update the order based on current position
              contacts: currentFlow.stages.find(s => s.id === step.id)?.contacts || []
            };
          } else {
            // For new steps, don't include ID - let the database generate it
            return {
              id: "", // This will trigger creation of a new stage
              name: step.name,
              color: step.color,
              stage_order: index, // Set order for new steps
              contacts: []
            };
          }
        })
      };

      await updateFlow(currentFlow.id, updatedFlow);
      
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

  const handleDeleteFlow = async () => {
    if (!currentFlow) return;

    try {
      // Use the context function to delete the flow
      await deleteFlow(currentFlow.id);

      toast({
        title: "Flow Deleted",
        description: `Flow "${currentFlow.name}" deleted successfully`,
      });

      // Close dialogs and navigate to dashboard
      setShowDeleteConfirm(false);
      setShowEditFlowDialog(false);
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  const handleStepDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(editFlowSteps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setEditFlowSteps(items);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = (() => {
    const source = profile?.full_name?.trim() || user?.email?.split('@')[0] || '';
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    if (parts[0]) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return 'U';
  })();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();
  const hasToolbarActions = !!(onSettingsClick || (viewMode && onViewModeChange) || onToggleSelectMode || (contactCounts && onFilterChange) || onDocsClick || onAnalyticsClick);
  const hasActiveFilter = !!(selectedFilter || showCompleted || selectedEngagementFilter || selectedCampusFilter);

  return (
    <div className="sticky top-0 z-50 border-b" style={{ backgroundColor: '#FAFAFA', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center gap-2 h-14 px-2 md:px-4">
        {/* Left: hamburger + flow icon + title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileSidebar}
            className="h-8 w-8 md:hidden flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {showBackButton && onBackClick && (
            <Button variant="ghost" size="icon" onClick={onBackClick} className="h-8 w-8 flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {showFlowIcon && (
            flowType === 'recurring' && cycleDays ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative flex-shrink-0">
                      <FlowIcon className="h-5 w-5 text-sidebar-foreground" />
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 flex items-center justify-center">
                        <RefreshCw className="h-2 w-2 text-white" />
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cycles every {cycleDays} days</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <FlowIcon className="h-5 w-5 text-sidebar-foreground flex-shrink-0" />
            )
          )}
          <div className="text-lg font-extralight truncate min-w-0">{title}</div>
        </div>

        {/* Right content slot for page-specific controls */}
        {rightContent && (
          <div className="flex justify-end">
            {rightContent}
          </div>
        )}

        {/* Desktop toolbar (md+) */}
        {hasToolbarActions && (
          <TooltipProvider delayDuration={200}>
            <div className="hidden md:flex items-center gap-1">
              {onSettingsClick && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onSettingsClick} className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
              )}

              {viewMode && onViewModeChange && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewModeChange(viewMode === 'kanban' ? 'table' : 'kanban')}
                      className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100"
                    >
                      {viewMode === 'kanban' ? <Table2 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{viewMode === 'kanban' ? 'Switch to table view' : 'Switch to grid view'}</TooltipContent>
                </Tooltip>
              )}

              {onToggleSelectMode && (
                <div className="flex items-center gap-0.5 border rounded-md p-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isSelectMode ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={onToggleSelectMode}
                        className="h-7 w-7 rounded-sm text-slate-600"
                      >
                        <CheckSquare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isSelectMode ? 'Exit select mode' : 'Select'}</TooltipContent>
                  </Tooltip>
                  {isSelectMode && onSelectAll && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onSelectAll}
                          className="h-7 w-7 rounded-sm text-slate-600"
                        >
                          <SquareCheck className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Select all</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}

              {contactCounts && onFilterChange && (
                <FlowHeaderFilters
                  teamMembers={teamMembers}
                  selectedFilter={selectedFilter}
                  onFilterChange={onFilterChange}
                  contactCounts={contactCounts}
                  showCompleted={showCompleted ?? false}
                  onShowCompletedChange={onShowCompletedChange ?? (() => {})}
                  completedCount={completedCount ?? 0}
                  selectedEngagementFilter={selectedEngagementFilter}
                  onEngagementFilterChange={onEngagementFilterChange}
                  selectedCampusFilter={selectedCampusFilter}
                  onCampusFilterChange={onCampusFilterChange}
                />
              )}

              {onAnalyticsClick && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onAnalyticsClick} className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100">
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Analytics</TooltipContent>
                </Tooltip>
              )}

              {onDocsClick && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onDocsClick} className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100">
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Docs</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        )}

        {/* Mobile overflow menu (<md) */}
        {hasToolbarActions && (
          <div className="flex md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 relative">
                  <MoreHorizontal className="h-4 w-4" />
                  {hasActiveFilter && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {onSettingsClick && (
                  <DropdownMenuItem onClick={onSettingsClick}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                )}
                {viewMode && onViewModeChange && (
                  <DropdownMenuItem onClick={() => onViewModeChange(viewMode === 'kanban' ? 'table' : 'kanban')}>
                    {viewMode === 'kanban' ? <Table2 className="mr-2 h-4 w-4" /> : <LayoutGrid className="mr-2 h-4 w-4" />}
                    {viewMode === 'kanban' ? 'Switch to table view' : 'Switch to grid view'}
                  </DropdownMenuItem>
                )}
                {onToggleSelectMode && (
                  <DropdownMenuItem onClick={onToggleSelectMode}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    {isSelectMode ? 'Exit select mode' : 'Select'}
                  </DropdownMenuItem>
                )}
                {contactCounts && onFilterChange && (
                  <div className="px-1 py-1">
                    <FlowHeaderFilters
                      teamMembers={teamMembers}
                      selectedFilter={selectedFilter}
                      onFilterChange={onFilterChange}
                      contactCounts={contactCounts}
                      showCompleted={showCompleted ?? false}
                      onShowCompletedChange={onShowCompletedChange ?? (() => {})}
                      completedCount={completedCount ?? 0}
                      selectedEngagementFilter={selectedEngagementFilter}
                      onEngagementFilterChange={onEngagementFilterChange}
                      selectedCampusFilter={selectedCampusFilter}
                      onCampusFilterChange={onCampusFilterChange}
                    />
                  </div>
                )}
                {onAnalyticsClick && (
                  <DropdownMenuItem onClick={onAnalyticsClick}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Analytics
                  </DropdownMenuItem>
                )}
                {onDocsClick && (
                  <DropdownMenuItem onClick={onDocsClick}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Docs
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Persistent right cluster: notifications, search, avatar */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <TooltipProvider delayDuration={200}>
            <NotificationBell />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100"
                  onClick={() => setShowGlobalSearch(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search (Ctrl+K)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="border-l border-gray-200 h-6 mx-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-1.5">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatar_url || ""} alt={displayName} />
                  <AvatarFallback>
                    {initials}
                  </AvatarFallback>
                </Avatar>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Global Search */}
      <GlobalSearch
        open={showGlobalSearch} 
        onOpenChange={setShowGlobalSearch} 
      />
      
      {/* Edit Flow Dialog */}
      <Dialog open={showEditFlowDialog} onOpenChange={setShowEditFlowDialog}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Flow</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-4">
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
                        {iconOptions.map((iconOption, iconIndex) => (
                          <button
                            key={iconIndex}
                            type="button"
                            onClick={() => setEditFlowIcon(iconOption.icon)}
                            className={`w-8 h-8 rounded-md border hover:bg-gray-100 flex items-center justify-center transition-colors ${
                              editFlowIcon === iconOption.icon ? 'bg-blue-100 border-blue-300' : 'border-gray-200'
                            }`}
                          >
                            <iconOption.icon className="h-4 w-4" />
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
                <DragDropContext onDragEnd={handleStepDragEnd}>
                  <Droppable droppableId="steps">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                      >
                        {editFlowSteps.map((step, index) => (
                          <Draggable key={`step-${index}`} draggableId={`step-${index}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 p-2 rounded-md border transition-colors ${
                                  snapshot.isDragging ? 'bg-muted shadow-md border-primary' : 'bg-background border-border hover:bg-muted/50'
                                }`}
                              >
                                <div 
                                  {...provided.dragHandleProps}
                                  className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
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
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
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
          
          <DialogFooter className="flex justify-between">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Flow
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditFlowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveFlow}>
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{currentFlow?.name}"? This action cannot be undone and will permanently remove all data associated with this flow, including contacts and flow stages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteFlow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
