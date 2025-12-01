import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, UserPlus } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface AddGroupMemberDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingMemberIds: string[];
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export const AddGroupMemberDialog = ({
  groupId,
  open,
  onOpenChange,
  existingMemberIds,
}: AddGroupMemberDialogProps) => {
  const { organization } = useProfile();
  const { addMember } = useGroupMembers(groupId);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [role, setRole] = useState<string>("member");

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["available-contacts", organization?.id, searchTerm, existingMemberIds],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from("contacts")
        .select("id, name, email, phone, avatar")
        .eq("organization_id", organization.id)
        .eq("status", "active")
        .order("name");

      if (existingMemberIds.length > 0) {
        query = query.not("id", "in", `(${existingMemberIds.join(",")})`);
      }

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!organization?.id && open,
  });

  const handleAdd = async () => {
    if (!selectedContact) return;

    await addMember.mutateAsync({
      group_id: groupId,
      contact_id: selectedContact.id,
      role,
      status: "active",
    });

    setSelectedContact(null);
    setSearchTerm("");
    setRole("member");
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedContact(null);
      setSearchTerm("");
      setRole("member");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Group Member</DialogTitle>
          <DialogDescription>
            Search for a contact to add to this group
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Contact</label>
            {selectedContact ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedContact.avatar} />
                  <AvatarFallback>{selectedContact.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{selectedContact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedContact.email || selectedContact.phone}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedContact(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Command className="border rounded-lg">
                <CommandInput
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                />
                <CommandList>
                  {isLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Searching...
                    </div>
                  ) : !contacts || contacts.length === 0 ? (
                    <CommandEmpty>No contacts found</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {contacts.map((contact) => (
                        <CommandItem
                          key={contact.id}
                          onSelect={() => setSelectedContact(contact)}
                          className="flex items-center gap-3 py-2"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={contact.avatar} />
                            <AvatarFallback>{contact.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{contact.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {contact.email || contact.phone}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            )}
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="leader">Leader</SelectItem>
                <SelectItem value="co-leader">Co-Leader</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedContact || addMember.isPending}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
