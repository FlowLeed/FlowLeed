import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FlowStage } from "@/types/crm";
import { Check } from "lucide-react";

interface BulkStageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: FlowStage[];
  onConfirm: (stageId: string) => void;
}

export const BulkStageChangeDialog: React.FC<BulkStageChangeDialogProps> = ({
  open,
  onOpenChange,
  stages,
  onConfirm,
}) => {
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  const handleConfirm = () => {
    if (selectedStageId) {
      onConfirm(selectedStageId);
      setSelectedStageId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Stage</DialogTitle>
          <DialogDescription>
            Select the stage to move all selected contacts to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setSelectedStageId(stage.id)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                selectedStageId === stage.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: stage.color || '#3b82f6' }}
                />
                <span className="font-medium">{stage.name}</span>
              </div>
              {selectedStageId === stage.id && (
                <Check className="h-5 w-5 text-primary" />
              )}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedStageId}>
            Move Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
