import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, MoveRight, UserPlus, Tag as TagIcon, Trash2, ArrowRightLeft } from "lucide-react";
import { BulkStageChangeDialog } from "./BulkStageChangeDialog";
import { BulkReassignDialog } from "./BulkReassignDialog";
import { BulkTagDialog } from "./BulkTagDialog";
import { BulkMoveToFlowDialog } from "./BulkMoveToFlowDialog";
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
import { FlowStage } from "@/types/crm";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onStageChange: (stageId: string) => Promise<void>;
  onReassign: (userId: string | null) => Promise<void>;
  onAddTags: (tags: string[]) => Promise<void>;
  onRemoveTags: (tags: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
  onMoveToFlow: (targetPipelineId: string, targetStageId: string) => Promise<void>;
  stages: FlowStage[];
  teamMembers: Array<{ id: string; name: string; avatar?: string }>;
  currentPipelineId: string;
  currentPipelineName: string;
  isLoading?: boolean;
}

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  selectedCount,
  onClearSelection,
  onStageChange,
  onReassign,
  onAddTags,
  onRemoveTags,
  onDelete,
  onMoveToFlow,
  stages,
  teamMembers,
  currentPipelineId,
  currentPipelineName,
  isLoading = false,
}) => {
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [removeTagDialogOpen, setRemoveTagDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveToFlowDialogOpen, setMoveToFlowDialogOpen] = useState(false);

  const handleStageChange = async (stageId: string) => {
    await onStageChange(stageId);
    setStageDialogOpen(false);
    onClearSelection();
  };

  const handleReassign = async (userId: string | null) => {
    await onReassign(userId);
    setReassignDialogOpen(false);
    onClearSelection();
  };

  const handleAddTags = async (tags: string[]) => {
    await onAddTags(tags);
    setAddTagDialogOpen(false);
    onClearSelection();
  };

  const handleRemoveTags = async (tags: string[]) => {
    await onRemoveTags(tags);
    setRemoveTagDialogOpen(false);
    onClearSelection();
  };

  const handleDelete = async () => {
    await onDelete();
    setDeleteDialogOpen(false);
    onClearSelection();
  };

  const handleMoveToFlow = async (targetPipelineId: string, targetStageId: string) => {
    await onMoveToFlow(targetPipelineId, targetStageId);
    setMoveToFlowDialogOpen(false);
    onClearSelection();
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg p-4 min-w-[600px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {selectedCount} {selectedCount === 1 ? 'person' : 'people'} selected
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStageDialogOpen(true)}
              disabled={isLoading}
            >
              <MoveRight className="h-4 w-4 mr-2" />
              Change Stage
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setMoveToFlowDialogOpen(true)}
              disabled={isLoading}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Move to Flow
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReassignDialogOpen(true)}
              disabled={isLoading}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Reassign
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddTagDialogOpen(true)}
              disabled={isLoading}
            >
              <TagIcon className="h-4 w-4 mr-2" />
              Add Tags
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRemoveTagDialogOpen(true)}
              disabled={isLoading}
            >
              <TagIcon className="h-4 w-4 mr-2" />
              Remove Tags
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <BulkStageChangeDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        stages={stages}
        onConfirm={handleStageChange}
      />

      <BulkReassignDialog
        open={reassignDialogOpen}
        onOpenChange={setReassignDialogOpen}
        teamMembers={teamMembers}
        onConfirm={handleReassign}
      />

      <BulkTagDialog
        open={addTagDialogOpen}
        onOpenChange={setAddTagDialogOpen}
        mode="add"
        onConfirm={handleAddTags}
      />

      <BulkTagDialog
        open={removeTagDialogOpen}
        onOpenChange={setRemoveTagDialogOpen}
        mode="remove"
        onConfirm={handleRemoveTags}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Flow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedCount} {selectedCount === 1 ? 'person' : 'people'} from this flow? 
              This will not delete the people from your database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkMoveToFlowDialog
        open={moveToFlowDialogOpen}
        onOpenChange={setMoveToFlowDialogOpen}
        currentPipelineId={currentPipelineId}
        currentPipelineName={currentPipelineName}
        selectedCount={selectedCount}
        onConfirm={handleMoveToFlow}
      />
    </>
  );
};
