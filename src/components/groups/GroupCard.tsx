import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Calendar, MoreVertical } from "lucide-react";
import { Group } from "@/hooks/useGroups";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupAvatar } from "./GroupAvatar";

interface GroupCardProps {
  group: Group;
}

const groupTypeLabels: Record<string, string> = {
  small_group: "Small Group",
  serving_team: "Serving Team",
  class: "Class",
  ministry: "Ministry",
};

const groupTypeColors: Record<string, string> = {
  small_group: "bg-blue-500/10 text-blue-500",
  serving_team: "bg-green-500/10 text-green-500",
  class: "bg-purple-500/10 text-purple-500",
  ministry: "bg-orange-500/10 text-orange-500",
};

export const GroupCard = ({ group }: GroupCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <GroupAvatar name={group.name} imageUrl={group.image_url} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="secondary"
                  className={groupTypeColors[group.group_type] || ""}
                >
                  {groupTypeLabels[group.group_type] || group.group_type}
                </Badge>
                {group.status === "inactive" && (
                  <Badge variant="outline">Inactive</Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold group-hover:text-primary transition-colors truncate">
                {group.name}
              </h3>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/groups/${group.id}`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>Edit Group</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {group.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {group.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{group.member_count || 0} members</span>
          </div>
          {group.capacity && (
            <span className="text-xs">/ {group.capacity} capacity</span>
          )}
        </div>

        {/* Meeting Info */}
        {(group.meeting_day || group.location) && (
          <div className="space-y-2 pt-2 border-t">
            {group.meeting_day && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {group.meeting_day}
                  {group.meeting_time && ` at ${group.meeting_time}`}
                </span>
              </div>
            )}
            {group.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{group.location}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate(`/groups/${group.id}`)}
        >
          View Group
        </Button>
      </div>
    </Card>
  );
};
