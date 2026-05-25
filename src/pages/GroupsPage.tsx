import { useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useGroups } from "@/hooks/useGroups";
import { useCampuses } from "@/hooks/useCampuses";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plus, Users, RefreshCw, HelpCircle, Search, X, Filter } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { GroupCard } from "@/components/groups/GroupCard";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const GroupsPage = () => {
  console.log("[GroupsPage] Component rendered");
  
  const { organization } = useProfile();
  console.log("[GroupsPage] Organization:", organization?.id);
  
  const { groups, isLoading } = useGroups(organization?.id);
  const { data: campuses = [] } = useCampuses();
  console.log("[GroupsPage] Groups:", groups, "Loading:", isLoading);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCampusIds, setSelectedCampusIds] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<"all" | "pco" | "flowleed">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSyncFromPco = async () => {
    if (!organization?.id) return;
    setSyncing(true);
    try {
      const { data: integ } = await supabase
        .from("integrations")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("service_name", "planning_center")
        .eq("status", "active")
        .maybeSingle();
      if (!integ) { toast.error("Planning Center not connected"); return; }
      toast.info("Syncing groups…", { description: "This may take a minute." });
      let more = true, safety = 0;
      while (more && safety < 10) {
        safety++;
        const { data, error } = await supabase.functions.invoke("pco-sync-groups", {
          body: { integrationId: integ.id },
        });
        if (error) throw error;
        more = !!data?.hasMore;
      }
      toast.info("Syncing attendance…");
      more = true; safety = 0;
      while (more && safety < 10) {
        safety++;
        const { data, error } = await supabase.functions.invoke("pco-sync-group-attendance", {
          body: { integrationId: integ.id },
        });
        if (error) throw error;
        more = !!data?.hasMore;
      }
      toast.success("Groups synced from Planning Center");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    } catch (e: any) {
      toast.error("Sync failed", { description: e.message });
    } finally {
      setSyncing(false);
    }
  };

  if (!organization) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-center py-12">
          <p>Loading organization...</p>
        </div>
      </div>
    );
  }

  // Derive a friendly category label from PCO group type name (text before ':'),
  // falling back to the local group_type enum for non-PCO groups.
  const categoryOf = (g: any): string => {
    const pcoName: string | null = g.pco_group_type_name;
    if (pcoName && pcoName.trim()) return pcoName.split(":")[0].trim();
    const map: Record<string, string> = {
      small_group: "Small Groups",
      serving_team: "Serving Teams",
      class: "Classes",
      ministry: "Ministries",
    };
    return map[g.group_type] || "Other";
  };

  const filteredGroups = groups.filter((g: any) => {
    if (selectedType !== "all" && categoryOf(g) !== selectedType) return false;
    if (selectedCampusIds.length > 0) {
      const ids: string[] = g.campus_ids?.length
        ? g.campus_ids
        : (g.campus_id ? [g.campus_id] : []);
      const effective = ids.length ? ids : ["none"];
      if (!effective.some((id) => selectedCampusIds.includes(id))) return false;
    }
    if (selectedDay !== "all" && (g.meeting_day || "Unspecified") !== selectedDay) return false;
    if (selectedSource === "pco" && !g.pco_group_id) return false;
    if (selectedSource === "flowleed" && g.pco_group_id) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay = `${g.name || ""} ${g.location || ""} ${g.description || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const categoryCounts = groups.reduce<Record<string, number>>((acc, g) => {
    const k = categoryOf(g);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const groupTypes = [
    { value: "all", label: "All Groups", count: groups.length },
    ...Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ value: label, label, count })),
  ];

  // Only show campuses that actually have groups assigned, plus "Unassigned" if any.
  // Use many-to-many campus_ids when present; fall back to campus_id.
  const campusGroupCounts = groups.reduce<Record<string, number>>((acc, g: any) => {
    const ids: string[] = g.campus_ids?.length
      ? g.campus_ids
      : (g.campus_id ? [g.campus_id] : []);
    if (ids.length === 0) {
      acc["none"] = (acc["none"] || 0) + 1;
    } else {
      for (const id of ids) acc[id] = (acc[id] || 0) + 1;
    }
    return acc;
  }, {});
  const campusOptions = campuses
    .filter((c) => campusGroupCounts[c.id])
    .map((c) => ({ value: c.id, label: c.name, count: campusGroupCounts[c.id] }));
  const hasUnassigned = (campusGroupCounts["none"] || 0) > 0;
  const unassignedCount = campusGroupCounts["none"] || 0;

  const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOptions = Array.from(
    new Set(groups.map((g: any) => (g.meeting_day || "").trim()).filter(Boolean))
  ).sort((a, b) => {
    const ia = dayOrder.indexOf(a);
    const ib = dayOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const pcoCount = groups.filter((g: any) => !!g.pco_group_id).length;
  const flowleedCount = groups.length - pcoCount;

  const hasActiveFilters = selectedType !== "all" || selectedCampusIds.length > 0 || selectedDay !== "all" || selectedSource !== "all" || searchQuery.trim() !== "";


  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="About Groups">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage your small groups, serving teams, and classes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
            <span className="text-sm text-muted-foreground ml-1">
              {filteredGroups.length}
              {filteredGroups.length !== groups.length && ` of ${groups.length}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSyncFromPco} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from PCO"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/groups/directory" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Public Directory
              </a>
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        </div>

        {/* Toolbar: search + filters in one compact row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search groups…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 justify-between min-w-[160px]">
                <span className="flex items-center gap-2 truncate">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {selectedCampusIds.length === 0
                    ? "All Campuses"
                    : selectedCampusIds.length === 1
                      ? (campusOptions.find((c) => c.value === selectedCampusIds[0])?.label
                          ?? (selectedCampusIds[0] === "none" ? "Unassigned" : "1 campus"))
                      : `${selectedCampusIds.length} campuses`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-2" align="start">
              <div className="space-y-1 max-h-72 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedCampusIds([])}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent flex items-center justify-between"
                >
                  <span className="font-medium">All Campuses</span>
                  <span className="text-xs text-muted-foreground">{groups.length}</span>
                </button>
                <div className="h-px bg-border my-1" />
                {campusOptions.map((c) => {
                  const checked = selectedCampusIds.includes(c.value);
                  return (
                    <label
                      key={c.value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setSelectedCampusIds((prev) =>
                            v ? [...prev, c.value] : prev.filter((id) => id !== c.value)
                          );
                        }}
                      />
                      <span className="flex-1 text-sm truncate">{c.label}</span>
                      <span className="text-xs text-muted-foreground">{c.count}</span>
                    </label>
                  );
                })}
                {hasUnassigned && (
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={selectedCampusIds.includes("none")}
                      onCheckedChange={(v) => {
                        setSelectedCampusIds((prev) =>
                          v ? [...prev, "none"] : prev.filter((id) => id !== "none")
                        );
                      }}
                    />
                    <span className="flex-1 text-sm">Unassigned</span>
                    <span className="text-xs text-muted-foreground">{unassignedCount}</span>
                  </label>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="All days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All days</SelectItem>
              {dayOptions.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              {groupTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label} ({type.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={selectedSource} onValueChange={(v) => setSelectedSource(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="h-7 text-xs">All {groups.length}</TabsTrigger>
              <TabsTrigger value="pco" className="h-7 text-xs">PCO {pcoCount}</TabsTrigger>
              <TabsTrigger value="flowleed" className="h-7 text-xs">FlowLeed {flowleedCount}</TabsTrigger>
            </TabsList>
          </Tabs>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setSelectedType("all");
                setSelectedCampusIds([]);
                setSelectedDay("all");
                setSelectedSource("all");
                setSearchQuery("");
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Groups Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No groups found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasActiveFilters ? "Try adjusting your filters" : "Create your first group to get started"}
            </p>
            {!hasActiveFilters && (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}

        {/* Create Group Dialog */}
        <CreateGroupDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          organizationId={organization?.id}
        />
      </div>
    </div>
  );
};

export default GroupsPage;

