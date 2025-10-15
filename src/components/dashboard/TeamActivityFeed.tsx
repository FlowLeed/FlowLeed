import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  interaction_type: string;
  subject: string;
  created_at: string;
  metadata: any;
  contacts: { id: string; name: string } | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface TeamActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
}

const getActivityDescription = (activity: Activity) => {
  const contactName = activity.contacts?.name || "Unknown";
  const userName = activity.profiles?.full_name || "Someone";
  const metadata = activity.metadata || {};

  switch (activity.interaction_type) {
    case "flow_added":
      return `${userName} added ${contactName} to ${metadata.pipeline_name || "a flow"}`;
    case "flow_stage_changed":
      return `${userName} moved ${contactName} to "${metadata.new_stage_name || "a stage"}"`;
    case "flow_assignment_changed":
      return `${userName} ${activity.subject?.toLowerCase() || "updated assignment"} for ${contactName}`;
    case "flow_removed":
      return `${userName} removed ${contactName} from ${metadata.pipeline_name || "a flow"}`;
    default:
      return activity.subject || `${userName} interacted with ${contactName}`;
  }
};

export const TeamActivityFeed = ({ activities, loading }: TeamActivityFeedProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-light">Recent Team Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-light">Recent Team Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recent team activity in the last 7 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-light">Recent Team Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={activity.profiles?.avatar_url || undefined} />
              <AvatarFallback>
                <UserCircle className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{getActivityDescription(activity)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
