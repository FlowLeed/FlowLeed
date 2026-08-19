import { useEffect, useState } from "react";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useCampuses } from "@/hooks/useCampuses";
import { useMarkerCatalog } from "@/hooks/useMarkerCatalog";
import { useProfile } from "@/hooks/useProfile";
import { useOrgTags } from "@/hooks/useOrgTags";
import { Link } from "react-router-dom";
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
  const { organization } = useProfile();
  const [searchInput, setSearchInput] = useState(filters.searchTerm);
  const { data: campuses } = useCampuses();
  const { data: markerCatalog } = useMarkerCatalog();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange("searchTerm", searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch organization members
  const { data: members } = useQuery({
    queryKey: ["org-members-filter", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Resolve active organization (same logic as useContacts)
      let organizationId: string | null = null;
      const savedOrg = localStorage.getItem('active_organization');
      if (savedOrg) {
        try {
          const orgData = JSON.parse(savedOrg);
          organizationId = orgData.id;
        } catch {
          // ignore
        }
      }
      if (!organizationId) {
        const { data: orgMembers } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1);
        if (!orgMembers || orgMembers.length === 0) return [];
        organizationId = orgMembers[0].organization_id;
      }

      // Step 1: fetch member user_ids
      const { data: orgUsers, error: membersErr } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId);
      if (membersErr || !orgUsers || orgUsers.length === 0) return [];

      const userIds = orgUsers.map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length === 0) return [];

      // Step 2: fetch profiles for those user_ids
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", userIds);

      const result = (profiles || [])
        .filter((p: any) => p.full_name || p.email)
        .map((p: any) => ({ user_id: p.user_id, profiles: p }));

      return result;
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

  // Tags come from the shared org tag source (same list as Settings > Tag Management)
  const { tagStats } = useOrgTags(organization?.id);

  // Count active filters (excluding search term)
  const activeFilterCount = [
    filters.assignedToUserId !== "all",
    filters.flowId !== "all",
    filters.lastInteractionDays !== "all",
    filters.engagementLevel !== "all",
    filters.campusId !== "all",
    filters.signal !== "all",
    filters.markerKey !== "all",
    filters.tag !== "all",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
      <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search people..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full px-2 py-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 max-h-[80vh] overflow-y-auto" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assigned to</label>
              <Select
                value={filters.assignedToUserId}
                onValueChange={(value) => onFilterChange("assignedToUserId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assigned to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assigned</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members?.map((member: any) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profiles?.full_name || member.profiles?.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Flow</label>
              <Select
                value={filters.flowId}
                onValueChange={(value) => onFilterChange("flowId", value)}
              >
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Last interaction</label>
              <Select
                value={filters.lastInteractionDays}
                onValueChange={(value) => onFilterChange("lastInteractionDays", value)}
              >
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Signal</label>
              <Select
                value={filters.signal}
                onValueChange={(value) => onFilterChange("signal", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Signal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Signals</SelectItem>
                  <SelectItem value="drifting">Drifting</SelectItem>
                  <SelectItem value="slowing">Slowing</SelectItem>
                  <SelectItem value="steady">Steady</SelectItem>
                  <SelectItem value="thriving">Thriving</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="none">Unscored</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Active marker</label>
              <Select
                value={filters.markerKey}
                onValueChange={(value) => onFilterChange("markerKey", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any marker" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">Any marker</SelectItem>
                  {(markerCatalog || [])
                    .filter((m) => !m.is_phase_two)
                    .map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label} ({m.contact_count})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Tag</label>
                <Link
                  to="/team?tab=tags"
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Manage tags
                </Link>
              </div>
              <Select
                value={filters.tag}
                onValueChange={(value) => onFilterChange("tag", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any tag" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">Any tag</SelectItem>
                  {tagStats.map(({ tag, count }) => (
                    <SelectItem key={tag} value={tag}>
                      {tag} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Engagement level</label>
              <Select
                value={filters.engagementLevel}
                onValueChange={(value) => onFilterChange("engagementLevel", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Engagement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="highly_engaged">Highly Engaged</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="none">Unscored (no check-ins)</SelectItem>
                </SelectContent>
              </Select>
            </div>


            {/* Campus filter - only show if campuses exist */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Campus</label>
              <Select
                value={filters.campusId}
                onValueChange={(value) => onFilterChange("campusId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Campus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campuses</SelectItem>
                  <SelectItem value="no-campus">No Campus</SelectItem>
                  {campuses?.map((campus) => (
                    <SelectItem key={campus.id} value={campus.id}>
                      {campus.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="w-full">
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
