import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Calendar, MoreVertical } from "lucide-react";
import { Group, useGroups } from "@/hooks/useGroups";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { GroupAvatar } from "./GroupAvatar";
import { EditGroupDialog } from "./EditGroupDialog";

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
  const { organization } = useProfile();
  const { deleteGroup } = useGroups(organization?.id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = () => {
    deleteGroup.mutate(group.id);
    setDeleteOpen(false);
  };

  const cleanDescription = group.description
    ? group.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : "";

  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <GroupAvatar name={group.name} imageUrl={group.image_url} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={groupTypeColors[group.group_type] || ""}
                >
                  {groupTypeLabels[group.group_type] || group.group_type}
                </Badge>
                {group.status === "inactive" && (
                  <Badge variant="outline">Inactive</Badge>
                )}
                {(group as any).pco_group_id && (
                  <Badge variant="outline" className="text-[10px] h-5">PCO</Badge>
                )}
              </div>
              <h3
                className="text-lg font-semibold hover:text-primary transition-colors cursor-pointer line-clamp-2 break-words"
                onClick={() => navigate(`/groups/${group.id}`)}
                title={group.name}
              >
                {group.name}
              </h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 -mr-2">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/groups/${group.id}`)}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  Edit Group
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description */}
          {cleanDescription && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {cleanDescription}
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

      <EditGroupDialog group={group} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this group and all its members. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
