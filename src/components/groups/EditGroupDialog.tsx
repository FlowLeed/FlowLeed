import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGroups, Group } from "@/hooks/useGroups";
import { Save } from "lucide-react";

interface EditGroupDialogProps {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditGroupDialog = ({ group, open, onOpenChange }: EditGroupDialogProps) => {
  const { updateGroup } = useGroups(group.organization_id);
  
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description || "",
    group_type: group.group_type,
    capacity: group.capacity?.toString() || "",
        meeting_day: group.meeting_day || "none",
        meeting_time: group.meeting_time || "",
        meeting_frequency: group.meeting_frequency || "none",
    location: group.location || "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: group.name,
        description: group.description || "",
        group_type: group.group_type,
        capacity: group.capacity?.toString() || "",
        meeting_day: group.meeting_day || "none",
        meeting_time: group.meeting_time || "",
        meeting_frequency: group.meeting_frequency || "none",
        location: group.location || "",
      });
    }
  }, [open, group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await updateGroup.mutateAsync({
      id: group.id,
      updates: {
        name: formData.name,
        description: formData.description || null,
        group_type: formData.group_type,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        meeting_day: formData.meeting_day === "none" ? null : formData.meeting_day || null,
        meeting_time: formData.meeting_time || null,
        meeting_frequency: formData.meeting_frequency === "none" ? null : formData.meeting_frequency || null,
        location: formData.location || null,
      },
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
          <DialogDescription>Update the group details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_type">Group Type</Label>
              <Select
                value={formData.group_type}
                onValueChange={(value) => setFormData({ ...formData, group_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small_group">Small Group</SelectItem>
                  <SelectItem value="serving_team">Serving Team</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="ministry">Ministry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting_day">Meeting Day</Label>
              <Select
                value={formData.meeting_day}
                onValueChange={(value) => setFormData({ ...formData, meeting_day: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
              <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="Monday">Monday</SelectItem>
                  <SelectItem value="Tuesday">Tuesday</SelectItem>
                  <SelectItem value="Wednesday">Wednesday</SelectItem>
                  <SelectItem value="Thursday">Thursday</SelectItem>
                  <SelectItem value="Friday">Friday</SelectItem>
                  <SelectItem value="Saturday">Saturday</SelectItem>
                  <SelectItem value="Sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting_time">Meeting Time</Label>
              <Input
                id="meeting_time"
                type="time"
                value={formData.meeting_time}
                onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting_frequency">Meeting Frequency</Label>
              <Select
                value={formData.meeting_frequency}
                onValueChange={(value) => setFormData({ ...formData, meeting_frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
              <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Meeting location"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateGroup.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
