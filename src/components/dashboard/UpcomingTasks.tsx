import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Circle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  subject: string;
  scheduled_at: string;
  contacts: { id: string; name: string } | null;
}

interface UpcomingTasksProps {
  tasks: Task[];
  loading?: boolean;
}

export const UpcomingTasks = ({ tasks, loading }: UpcomingTasksProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-light">My Upcoming Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-light">My Upcoming Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No upcoming tasks scheduled.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-light">My Upcoming Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            to={`/contacts/${task.contacts?.id}`}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Circle className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">
                {task.subject || "Follow up"} - {task.contacts?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(task.scheduled_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </Link>
        ))}
        <div className="pt-2">
          <Link to="/contacts">
            <Button variant="ghost" className="w-full justify-between">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
