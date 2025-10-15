import { Button } from "@/components/ui/button";
import { UserPlus, MessageSquare, CheckSquare } from "lucide-react";

interface QuickActionButtonsProps {
  onAddContact?: () => void;
  onLogInteraction?: () => void;
  onCreateTask?: () => void;
}

export const QuickActionButtons = ({
  onAddContact,
  onLogInteraction,
  onCreateTask,
}: QuickActionButtonsProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onAddContact} size="sm">
        <UserPlus className="h-4 w-4 mr-2" />
        Add Contact
      </Button>
      <Button onClick={onLogInteraction} variant="outline" size="sm">
        <MessageSquare className="h-4 w-4 mr-2" />
        Log Interaction
      </Button>
      <Button onClick={onCreateTask} variant="outline" size="sm">
        <CheckSquare className="h-4 w-4 mr-2" />
        Create Task
      </Button>
    </div>
  );
};
