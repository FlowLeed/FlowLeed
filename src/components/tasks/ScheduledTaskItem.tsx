import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ScheduledTask {
  id: string;
  subject: string | null;
  scheduled_at: string | null;
  interaction_type: string;
  contact_id: string;
  completed_at: string | null;
  contact: { id: string; name: string; avatar: string | null } | null;
}

export const ScheduledTaskItem = ({ task }: { task: ScheduledTask }) => {
  const queryClient = useQueryClient();
  const isCompleted = !!task.completed_at;
  const isOverdue = !isCompleted && task.scheduled_at && new Date(task.scheduled_at) < new Date();

  const toggleComplete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contact_interactions")
        .update({ completed_at: isCompleted ? null : new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-scheduled-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-upcoming-tasks"] });
    },
  });

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => toggleComplete.mutate()}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
          {task.subject || "Follow up"}
          {task.contact && (
            <Link to={`/contacts/${task.contact.id}`} className="text-primary hover:underline ml-1">
              — {task.contact.name}
            </Link>
          )}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-xs font-normal capitalize">
            {task.interaction_type}
          </Badge>
          {task.scheduled_at && (
            <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {isOverdue ? "Overdue · " : ""}
              {formatDistanceToNow(new Date(task.scheduled_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
