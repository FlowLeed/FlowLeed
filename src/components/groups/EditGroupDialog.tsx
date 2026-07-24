import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useGroups, Group } from "@/hooks/useGroups";
import { Save, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GroupImageUpload } from "./GroupImageUpload";
import { LeaderSelector } from "./LeaderSelector";
import { AIGroupDescriptionSuggestions } from "./AIGroupDescriptionSuggestions";
import { useGroupTypes } from "@/hooks/useGroupTypes";

interface EditGroupDialogProps {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditGroupDialog = ({ group, open, onOpenChange }: EditGroupDialogProps) => {
  const { updateGroup } = useGroups(group.organization_id);
  const { types: groupTypes } = useGroupTypes(group.organization_id);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(group.image_url || null);
  
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description || "",
    group_type: group.group_type,
    capacity: group.capacity?.toString() || "",
    meeting_day: group.meeting_day || "none",
    meeting_time: group.meeting_time || "",
    meeting_frequency: group.meeting_frequency || "none",
    location: group.location || "",
    visibility: group.visibility || "private",
    allow_public_signup: group.allow_public_signup || false,
    leader_user_id: group.leader_user_id || null,
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
        visibility: group.visibility || "private",
        allow_public_signup: group.allow_public_signup || false,
        leader_user_id: group.leader_user_id || null,
      });
      setImageUrl(group.image_url || null);
      setCopied(false);
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
        visibility: formData.visibility,
        allow_public_signup: formData.allow_public_signup,
        image_url: imageUrl,
        leader_user_id: formData.leader_user_id,
      },
    });

    onOpenChange(false);
  };

  const getSignupLink = () => {
    if (!group.public_signup_token) return "";
    return `${window.location.origin}/groups/join/${group.public_signup_token}`;
  };

  const copySignupLink = async () => {
    const link = getSignupLink();
    if (!link) return;
    
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Public signup link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
          <DialogDescription>Update the group details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <GroupImageUpload
            groupName={formData.name}
            currentImageUrl={imageUrl}
            onImageChange={setImageUrl}
            groupId={group.id}
          />

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
              <AIGroupDescriptionSuggestions
                groupName={formData.name}
                groupType={formData.group_type}
                meetingDay={formData.meeting_day}
                meetingFrequency={formData.meeting_frequency}
                location={formData.location}
                currentDescription={formData.description}
                organizationId={group.organization_id}
                onSelect={(desc) => setFormData({ ...formData, description: desc })}
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
                  {groupTypes.length === 0 && <SelectItem value={formData.group_type}>{formData.group_type}</SelectItem>}
                  {groupTypes.map((t) => (
                    <SelectItem key={t.id} value={t.key}>{t.label}</SelectItem>
                  ))}
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

            {/* Leader Assignment */}
            <div className="col-span-2">
              <LeaderSelector
                organizationId={group.organization_id}
                value={formData.leader_user_id}
                onChange={(userId) => setFormData({ ...formData, leader_user_id: userId })}
              />
            </div>

            {/* Visibility Settings */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="font-medium mb-3">Public Access Settings</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select
                    value={formData.visibility}
                    onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private - Only visible to organization</SelectItem>
                      <SelectItem value="unlisted">Unlisted - Accessible via link only</SelectItem>
                      <SelectItem value="public">Public - Visible in public directory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="allow_public_signup" className="cursor-pointer">
                      Allow Public Signup
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Enable a public link for people to request to join this group
                    </p>
                  </div>
                  <Switch
                    id="allow_public_signup"
                    checked={formData.allow_public_signup}
                    onCheckedChange={(checked) => setFormData({ ...formData, allow_public_signup: checked })}
                  />
                </div>

                {formData.allow_public_signup && group.public_signup_token && (
                  <div className="space-y-2">
                    <Label>Public Signup Link</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={getSignupLink()}
                        className="bg-muted text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copySignupLink}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this link to allow people to request to join this group
                    </p>
                  </div>
                )}
              </div>
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
