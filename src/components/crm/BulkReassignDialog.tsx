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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check } from "lucide-react";

interface BulkReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: Array<{ id: string; name: string; avatar?: string }>;
  onConfirm: (userId: string | null) => void;
}

export const BulkReassignDialog: React.FC<BulkReassignDialogProps> = ({
  open,
  onOpenChange,
  teamMembers,
  onConfirm,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleConfirm = () => {
    onConfirm(selectedUserId);
    setSelectedUserId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign People</DialogTitle>
          <DialogDescription>
            Select a team member to assign all selected people to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
          <button
            onClick={() => setSelectedUserId(null)}
            className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
              selectedUserId === null
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
              <span className="font-medium">Unassigned</span>
            </div>
            {selectedUserId === null && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </button>

          {teamMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedUserId(member.id)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                selectedUserId === member.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatar} alt={member.name} />
                  <AvatarFallback>
                    {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{member.name}</span>
              </div>
              {selectedUserId === member.id && (
                <Check className="h-5 w-5 text-primary" />
              )}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Assign People
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
