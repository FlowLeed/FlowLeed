import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Lock, ArrowRight, Activity, TrendingDown, Sparkles, Building2, User, X, Info, Wand2, Bot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const markerFormulas: Record<string, string> = {
  attended_sunday_recent: "Fires when the contact has any service check-in in the last 14 days.",
  consistent_attender: "Attended a service in at least 3 of the last 4 weeks.",
  first_time_guest: "Has a check-in flagged as guest in the last 30 days.",
  kids_checked_in: "A household member checked in (e.g. kids) in the last 30 days.",
  missed_3_sundays: "Previously regular (4+ lifetime check-ins) AND last service attendance is between 21 and 42 days ago.",
  drifting_6_weeks: "Previously regular (4+ lifetime check-ins) AND last service attendance is more than 42 days ago (or never recorded).",
  attendance_dropped: "Attended 4+ of the prior 12 weeks, and the last 12 weeks are ≤ half of that prior count.",
  in_group: "Active member of at least one small group.",
  group_attendance_high: "Attended ≥ 66% of the last 3+ group meetings.",
  group_attendance_mid: "Attended 33–66% of the last 3+ group meetings.",
  group_attendance_low: "Attended < 33% of the last 4+ group meetings.",
  group_inactive_30d: "In a group but no group attendance in the last 30 days.",
  served_recently: "Volunteered / served at least once in the last 30 days.",
  serves_regularly: "Served 3+ times in the last 90 days.",
  stopped_serving: "Served 3+ times in the last 180 days, but 0 times in the last 90, and last serve was 60+ days ago.",
  in_active_flow: "Currently in 1+ active flows.",
  stuck_in_stage_30d: "Has been in their current flow stage for 30+ days.",
  flow_moment_recent: "Logged 1+ flow moment (next step) in the last 90 days.",
  salvation_moment: "Has a salvation decision recorded.",
  watched_online_recent: "Watched 1+ online events in the last 30 days.",
  prayer_request_submitted: "Submitted 1+ prayer requests in the last 90 days.",
};
import { useMarkerCatalog, useRecomputeMarkers, type MarkerCatalogEntry } from "@/hooks/useMarkerCatalog";
import { useCampuses } from "@/hooks/useCampuses";
import { useAuth } from "@/hooks/useAuth";
import { useOrgMembers } from "@/hooks/useOrgMembers";

const polarityClass: Record<string, string> = {
  positive: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300",
};

const SignalsPage = () => {
  const { user } = useAuth();
  const [campusId, setCampusId] = useState<string | null>(null);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const { data: campuses } = useCampuses();
  const { data: members } = useOrgMembers(user?.id, !!user?.id);
  const { data: catalog, isLoading } = useMarkerCatalog({ campusId, assignedUserId });
  const recompute = useRecomputeMarkers();
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "phase2">("all");
  const hasFilters = campusId !== null || assignedUserId !== null;

  const filtered = useMemo(() => {
    if (!catalog) return [];
    if (filter === "phase2") return catalog.filter((m) => m.is_phase_two);
    if (filter === "positive") return catalog.filter((m) => !m.is_phase_two && m.polarity === "positive");
    if (filter === "negative") return catalog.filter((m) => !m.is_phase_two && m.polarity === "negative");
    return catalog.filter((m) => !m.is_phase_two);
  }, [catalog, filter]);

  const grouped = useMemo(() => {
    const g = new Map<string, MarkerCatalogEntry[]>();
    for (const m of filtered) {
      if (!g.has(m.category)) g.set(m.category, []);
      g.get(m.category)!.push(m);
    }
    return Array.from(g.entries());
  }, [filtered]);

  const totals = useMemo(() => {
    if (!catalog) return { pos: 0, neg: 0 };
    const live = catalog.filter((m) => !m.is_phase_two);
    return {
      pos: live.filter((m) => m.polarity === "positive").reduce((s, m) => s + m.contact_count, 0),
      neg: live.filter((m) => m.polarity === "negative").reduce((s, m) => s + m.contact_count, 0),
    };
  }, [catalog]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Signals"
        titleBadge={
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-purple-500/50 text-purple-600 dark:text-purple-400">
            Beta
          </Badge>
        }
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/signals/custom">
                <Wand2 className="h-4 w-4" /> Custom
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/signals/agent">
                <Bot className="h-4 w-4" /> AI Agent
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${recompute.isPending ? "animate-spin" : ""}`} />
              Recompute
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {campuses && campuses.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={campusId ?? "all"}
                onValueChange={(v) => setCampusId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="All Campuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campuses</SelectItem>
                  {campuses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {members && members.length > 0 && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select
                value={assignedUserId ?? "all"}
                onValueChange={(v) => setAssignedUserId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="All Leaders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leaders</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCampusId(null); setAssignedUserId(null); }}
              className="gap-1"
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="Active markers tracked"
            value={catalog?.filter((m) => !m.is_phase_two).length || 0}
            icon={Activity}
          />
          <SummaryCard label="Positive signals (totals)" value={totals.pos} icon={Sparkles} tone="positive" />
          <SummaryCard label="Risk signals (totals)" value={totals.neg} icon={TrendingDown} tone="negative" />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All active</TabsTrigger>
            <TabsTrigger value="positive">Positive</TabsTrigger>
            <TabsTrigger value="negative">Risk</TabsTrigger>
            <TabsTrigger value="phase2">Coming soon</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((m) => (
                    <MarkerRow key={m.key} marker={m} />
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No markers in this view.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function SummaryCard({ label, value, icon: Icon, tone }: any) {
  const toneClass =
    tone === "positive"
      ? "text-green-600 dark:text-green-400"
      : tone === "negative"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-light">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MarkerRow({ marker }: { marker: MarkerCatalogEntry }) {
  const locked = marker.is_phase_two;
  return (
    <Card className={locked ? "opacity-60" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={`text-xs ${polarityClass[marker.polarity]}`}>
                {marker.polarity}
              </Badge>
              <p className="font-medium text-sm truncate">{marker.label}</p>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{marker.description}</p>
            {locked && marker.requires_integration && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Requires {marker.requires_integration.replace("pco_", "Planning Center ")}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="How this is calculated"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs font-medium mb-1">How it's calculated</p>
                    <p className="text-xs text-muted-foreground">
                      {markerFormulas[marker.key] || marker.description}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-2xl font-light">{marker.contact_count}</span>
            </div>
            {!locked && marker.contact_count > 0 && (
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <Link to={`/contacts?marker=${marker.key}`}>
                  View <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

export default SignalsPage;
