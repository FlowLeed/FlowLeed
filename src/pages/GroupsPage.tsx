import { useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useGroups } from "@/hooks/useGroups";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plus, Users, RefreshCw, HelpCircle, MapPin, Search, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GroupCard } from "@/components/groups/GroupCard";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const GroupsPage = () => {
  console.log("[GroupsPage] Component rendered");
  
  const { organization } = useProfile();
  console.log("[GroupsPage] Organization:", organization?.id);
  
  const { groups, isLoading } = useGroups(organization?.id);
  console.log("[GroupsPage] Groups:", groups, "Loading:", isLoading);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
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
    if (selectedLocation !== "all" && (g.location || "Unspecified") !== selectedLocation) return false;
    if (selectedDay !== "all" && (g.meeting_day || "Unspecified") !== selectedDay) return false;
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

  const locationOptions = Array.from(
    new Set(groups.map((g: any) => (g.location || "").trim()).filter(Boolean))
  ).sort();

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

  const hasActiveFilters = selectedType !== "all" || selectedLocation !== "all" || selectedDay !== "all" || searchQuery.trim() !== "";


  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="About Groups">
                    <HelpCircle className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage your small groups, serving teams, and classes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSyncFromPco} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from PCO"}
            </Button>
            <Button variant="outline" asChild>
              <a href="/groups/directory" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Public Directory
              </a>
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        </div>

        {/* Group Type Tabs */}
        <Tabs value={selectedType} onValueChange={setSelectedType}>
          <div className="overflow-x-auto">
            <TabsList className="w-max">
              {groupTypes.map((type) => (
                <TabsTrigger key={type.value} value={type.value}>
                  {type.label} ({type.count})
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {/* Groups Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first group to get started
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
