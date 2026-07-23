import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  X,
  MoveRight,
  UserPlus,
  Tag as TagIcon,
  Trash2,
  ArrowRightLeft,
  Download,
  Plus,
  Minus,
} from "lucide-react";
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
  onExport: () => void;
  stages: FlowStage[];
  teamMembers: Array<{ id: string; name: string; avatar?: string }>;
  teamMembersLoading?: boolean;
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
  onExport,
  stages,
  teamMembers,
  teamMembersLoading = false,
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

  const iconBtn =
    "flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[640px] px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 p-1.5 h-14 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/10 shadow-2xl">
          {/* Selection status */}
          <div className="flex items-center gap-2 px-3 border-r border-slate-700/50 mr-1 h-full">
            <span className="flex items-center justify-center min-w-6 h-6 px-1.5 bg-blue-500 text-white text-xs font-bold rounded-full">
              {selectedCount}
            </span>
            <span className="text-slate-200 text-sm font-medium whitespace-nowrap hidden sm:inline">
              selected
            </span>
          </div>

          {/* Actions */}
          <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {/* Movement group */}
            <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setStageDialogOpen(true)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MoveRight className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold whitespace-nowrap">Step</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Change Step</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setMoveToFlowDialogOpen(true)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold whitespace-nowrap">Flow</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Move to Flow</TooltipContent>
              </Tooltip>
            </div>

            {/* Reassign */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setReassignDialogOpen(true)}
                  disabled={isLoading}
                  className={iconBtn}
                  aria-label="Reassign"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reassign</TooltipContent>
            </Tooltip>

            {/* Tags (consolidated) */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={isLoading}
                      className={iconBtn}
                      aria-label="Tags"
                    >
                      <TagIcon className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Tags</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="center" sideOffset={8}>
                <DropdownMenuItem onClick={() => setAddTagDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add tags…
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRemoveTagDialogOpen(true)}>
                  <Minus className="w-4 h-4 mr-2" />
                  Remove tags…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Utility & destructive */}
          <div className="flex items-center gap-1 pl-2 ml-1 border-l border-slate-700/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onExport}
                  disabled={isLoading}
                  className={iconBtn}
                  aria-label="Export CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isLoading}
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Remove from flow</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onClearSelection}
                  disabled={isLoading}
                  className={iconBtn}
                  aria-label="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Clear selection</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

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
        isLoading={teamMembersLoading}
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
    </TooltipProvider>
  );
};
