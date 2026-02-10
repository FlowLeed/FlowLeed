import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface LeaderSelectorProps {
  organizationId: string;
  value: string | null;
  onChange: (userId: string | null) => void;
}

interface TeamMember {
  user_id: string;
  role: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
}

export const LeaderSelector = ({ organizationId, value, onChange }: LeaderSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(!value);

  const { data: members, isLoading } = useQuery({
    queryKey: ["org-team-members", organizationId, searchTerm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, role, profiles(full_name, avatar_url, email)")
        .eq("organization_id", organizationId)
        .order("role");

      if (error) throw error;

      let results: TeamMember[] = (data || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: m.profiles?.full_name || "Unknown",
        avatar_url: m.profiles?.avatar_url || null,
        email: m.profiles?.email || null,
      }));

      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        results = results.filter(
          (m) =>
            m.full_name.toLowerCase().includes(lower) ||
            (m.email && m.email.toLowerCase().includes(lower))
        );
      }

      return results;
    },
    enabled: !!organizationId,
  });

  const selectedMember = members?.find((m) => m.user_id === value);

  if (value && selectedMember && !isSearching) {
    return (
      <div className="space-y-2">
        <Label>Group Leader</Label>
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
          <Avatar className="h-10 w-10">
            <AvatarImage src={selectedMember.avatar_url || undefined} />
            <AvatarFallback>{selectedMember.full_name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{selectedMember.full_name}</p>
            <p className="text-sm text-muted-foreground capitalize">{selectedMember.role}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsSearching(true)}>
            Change
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => {
              onChange(null);
              setIsSearching(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Group Leader</Label>
      <Command className="border rounded-lg">
        <CommandInput
          placeholder="Search team members by name or email..."
          value={searchTerm}
          onValueChange={setSearchTerm}
        />
        <CommandList>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
          ) : !members || members.length === 0 ? (
            <CommandEmpty>No team members found</CommandEmpty>
          ) : (
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.user_id}
                  value={`${member.full_name} ${member.email || ""}`}
                  onSelect={() => {
                    onChange(member.user_id);
                    setIsSearching(false);
                    setSearchTerm("");
                  }}
                  className="flex items-center gap-3 py-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>{member.full_name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.full_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
};
