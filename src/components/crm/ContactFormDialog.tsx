
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
  const [formData, setFormData] = useState<Partial<Contact>>({
    name: "",
    date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
    tags: [],
    status: "active",
    assignedTo: {
      name: "Alex Yarmolati"
    },
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (contact) {
      setFormData(contact);
    } else {
      setFormData({
        name: "",
        date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        tags: [],
        status: "active",
        assignedTo: {
          name: "Alex Yarmolati"
        },
        email: "",
        phone: "",
      });
    }
  }, [contact]);

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
