import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContactFilters as Filters } from "@/pages/ContactsPage";

interface ContactFiltersProps {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export const ContactFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
}: ContactFiltersProps) => {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState(filters.searchTerm);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange("searchTerm", searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch organization members
  const { data: members } = useQuery({
    queryKey: ["org-members", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: orgMember } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!orgMember) return [];

      const { data } = await supabase
        .from("organization_members")
        .select("user_id, profiles(user_id, full_name, avatar_url)")
        .eq("organization_id", orgMember.organization_id);

      return data || [];
    },
    enabled: !!user,
  });

  // Fetch flows
  const { data: flows } = useQuery({
    queryKey: ["flows-for-filter", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data } = await supabase
        .from("pipelines")
        .select("id, name, icon")
        .order("name");

      return data || [];
    },
    enabled: !!user,
  });

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      <Select
        value={filters.assignedToUserId}
        onValueChange={(value) => onFilterChange("assignedToUserId", value)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Assigned to" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assigned</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {members?.map((member: any) => (
            <SelectItem key={member.user_id} value={member.user_id}>
              {member.profiles?.full_name || "Unknown"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.flowId}
        onValueChange={(value) => onFilterChange("flowId", value)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Flow" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Flows</SelectItem>
          <SelectItem value="no-flows">No Flows</SelectItem>
          {flows?.map((flow: any) => (
            <SelectItem key={flow.id} value={flow.id}>
              {flow.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.lastInteractionDays}
        onValueChange={(value) => onFilterChange("lastInteractionDays", value)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Last interaction" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
          <SelectItem value="never">Never contacted</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
};
