import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Calendar, MoreVertical } from "lucide-react";
import { Group, useGroups } from "@/hooks/useGroups";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const { organization } = useProfile();
  const { deleteGroup } = useGroups(organization?.id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = () => {
    deleteGroup.mutate(group.id);
    setDeleteOpen(false);
  };

  const openGroup = () => {
    queryClient.setQueryData(["group", group.id], group);
    navigate(`/groups/${group.id}`);
  };

  const cleanDescription = group.description
    ? group.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : "";

  return (
    <>
      <Card
        className="p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group flex flex-col gap-3"
        onClick={openGroup}
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          <GroupAvatar name={group.name} imageUrl={group.image_url} size="md" />
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold leading-tight line-clamp-2 break-words group-hover:text-primary transition-colors"
              title={group.name}
            >
              {group.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge
                variant="secondary"
                className={`text-[10px] h-4 px-1.5 font-medium ${groupTypeColors[group.group_type] || ""}`}
              >
                {groupTypeLabels[group.group_type] || group.group_type}
              </Badge>
              {group.status === "inactive" && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">Inactive</Badge>
              )}
              {(group as any).pco_group_id && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">PCO</Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 -mr-1 -mt-1">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={openGroup}>View Details</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit Group</DropdownMenuItem>
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
          <p className="text-xs text-muted-foreground line-clamp-2">
            {cleanDescription}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t flex-wrap">
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>
              {group.member_count || 0}
              {group.capacity ? `/${group.capacity}` : ""}
            </span>
          </div>
          {group.meeting_day && (
            <div className="flex items-center gap-1 min-w-0">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {group.meeting_day}{group.meeting_time && ` · ${group.meeting_time}`}
              </span>
            </div>
          )}
          {group.location && (
            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{group.location}</span>
            </div>
          )}
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
