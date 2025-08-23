import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Contact, Tag } from "@/types/crm";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

interface OrganizationMember {
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
}

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSave: (contact: Contact) => void;
}

export const ContactFormDialog: React.FC<ContactFormDialogProps> = ({
  open,
  onOpenChange,
  contact,
  onSave,
}) => {
  const { profile, organization } = useProfile();
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [formData, setFormData] = useState<Partial<Contact>>({
    name: "",
    date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
    tags: [],
    status: "active",
    assignedTo: profile ? {
      name: profile.full_name || profile.email,
      avatar: profile.avatar_url || undefined
    } : undefined,
    email: "",
    phone: "",
  });

  // Fetch organization members when dialog opens
  useEffect(() => {
    if (open && organization) {
      fetchOrganizationMembers();
    }
  }, [open, organization]);

  const fetchOrganizationMembers = async () => {
    if (!organization) return;

    setLoadingMembers(true);
    try {
      // First get organization members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization.id);

      if (membersError) throw membersError;

      if (members && members.length > 0) {
        // Then get profiles for these users
        const userIds = members.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        // Combine the data
        const combinedData: OrganizationMember[] = members.map(member => ({
          user_id: member.user_id,
          profiles: profiles?.find(p => p.user_id === member.user_id) || null
        }));

        setOrganizationMembers(combinedData);
      }
    } catch (error) {
      console.error('Error fetching organization members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (contact) {
      setFormData(contact);
    } else {
      setFormData({
        name: "",
        date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        tags: [],
        status: "active",
        assignedTo: profile ? {
          name: profile.full_name || profile.email,
          avatar: profile.avatar_url || undefined
        } : undefined,
        email: "",
        phone: "",
      });
    }
  }, [contact, profile]);

  const handleAssignedToChange = (userId: string) => {
    const selectedMember = organizationMembers.find(member => member.user_id === userId);
    if (selectedMember) {
      handleChange("assignedTo", {
        name: selectedMember.profiles?.full_name || selectedMember.profiles?.email || "Unknown User",
        avatar: undefined // We could fetch this from profiles if needed
      });
    } else if (userId === "unassigned") {
      handleChange("assignedTo", undefined);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTagToggle = (tag: Tag) => {
    setFormData((prev) => {
      const currentTags = prev.tags || [];
      if (currentTags.includes(tag)) {
        return { ...prev, tags: currentTags.filter((t) => t !== tag) };
      } else {
        return { ...prev, tags: [...currentTags, tag] };
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate an ID if this is a new contact
    const finalContact = {
      id: contact?.id || Math.random().toString(36).substring(2, 10),
      ...formData
    } as Contact;
    
    onSave(finalContact);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assigned To</Label>
            <Select
              value={
                formData.assignedTo
                  ? organizationMembers.find(member => 
                      (member.profiles?.full_name || member.profiles?.email) === formData.assignedTo?.name
                    )?.user_id || "unassigned"
                  : "unassigned"
              }
              onValueChange={handleAssignedToChange}
              disabled={loadingMembers}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingMembers ? "Loading..." : "Select assignee"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {organizationMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profiles?.full_name || member.profiles?.email || "Unknown User"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-4 pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tag-active"
                  checked={(formData.tags || []).includes("active")}
                  onCheckedChange={() => handleTagToggle("active")}
                />
                <label htmlFor="tag-active">Active</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tag-partner"
                  checked={(formData.tags || []).includes("partner")}
                  onCheckedChange={() => handleTagToggle("partner")}
                />
                <label htmlFor="tag-partner">Partner</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tag-florida"
                  checked={(formData.tags || []).includes("florida")}
                  onCheckedChange={() => handleTagToggle("florida")}
                />
                <label htmlFor="tag-florida">Florida</label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};