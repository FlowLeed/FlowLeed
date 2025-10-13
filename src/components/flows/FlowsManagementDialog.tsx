import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical,
  Plus,
  Settings,
  Trash2,
  Users,
  MessageSquare,
  Calendar,
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
  Sparkles,
  Check,
  Puzzle,
  LayoutDashboard,
  BarChart3
} from "lucide-react";
import { useFlowContext } from "@/contexts/FlowContext";
import { useProfile } from "@/hooks/useProfile";
import { FlowSettingsDialog } from "@/components/crm/FlowSettingsDialog";
import { CreateFlowDialog } from "@/components/flows/CreateFlowDialog";
import { calculateFlowContactCount } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Flow } from "@/types/crm";
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

interface FlowsManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Icon mapping for flow icons
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

export const FlowsManagementDialog: React.FC<FlowsManagementDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { flows, deleteFlow, reorderFlows, createFlow } = useFlowContext();
  const { organization } = useProfile();
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState<Flow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Convert flows object to array and sort by flow_order
  const flowsArray = Object.values(flows).sort((a, b) => 
    (a.flow_order || 0) - (b.flow_order || 0)
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(flowsArray);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update flow_order for all flows
    const reorderedFlows = items.map((flow, index) => ({
      ...flow,
      flow_order: index
    }));

    reorderFlows(reorderedFlows);
  };

  const handleDeleteClick = (flow: Flow) => {
    setFlowToDelete(flow);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (flowToDelete) {
      await deleteFlow(flowToDelete.id);
      setShowDeleteDialog(false);
      setFlowToDelete(null);
    }
  };

  const getFlowIcon = (iconName?: string) => {
    if (!iconName) return Users;
    return iconMap[iconName] || Users;
  };

  const editingFlow = editingFlowId ? flows[editingFlowId] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-2xl">Manage Flows</DialogTitle>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Flow
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="flows-list">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {flowsArray.map((flow, index) => {
                      const FlowIcon = getFlowIcon(flow.icon);
                      const contactCount = calculateFlowContactCount(flow);

                      return (
                        <Draggable key={flow.id} draggableId={flow.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-3 p-4 bg-card border rounded-lg transition-shadow ${
                                snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                              }`}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                              </div>

                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                                <FlowIcon className="h-5 w-5 text-primary" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base truncate">
                                  {flow.name}
                                </h3>
                                {flow.description && (
                                  <p className="text-sm text-muted-foreground truncate">
                                    {flow.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {flow.stages?.length || 0} stages
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {contactCount} contacts
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingFlowId(flow.id)}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(flow)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {flowsArray.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No flows yet. Create your first flow to get started!</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Flow Settings Dialog */}
      {editingFlow && organization && (
        <FlowSettingsDialog
          open={!!editingFlowId}
          onOpenChange={(open) => !open && setEditingFlowId(null)}
          flowId={editingFlow.id}
          flowName={editingFlow.name}
          flowDescription={editingFlow.description}
          flowIcon={editingFlow.icon}
          flowStages={editingFlow.stages.map((stage, index) => ({
            id: stage.id,
            name: stage.name,
            color: stage.color || '#3b82f6',
            stage_order: index,
            is_start_step: stage.is_start_step,
            is_end_step: stage.is_end_step
          }))}
          organizationId={organization.id}
          onSave={() => {
            setEditingFlowId(null);
          }}
        />
      )}

      {/* Create Flow Dialog */}
      <CreateFlowDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{flowToDelete?.name}"? This action cannot be
              undone. All contacts in this flow will remain in your system but will be removed
              from this flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
