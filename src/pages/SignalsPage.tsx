import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RefreshCw, Lock, ArrowRight, Activity, TrendingDown, Sparkles, Building2, User, X, Info, Wand2, Bot, MoreVertical, Pencil, EyeOff, Eye, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { markerFormula } from "@/lib/markerParams";
import { MarkerSettingsDialog } from "@/components/signals/MarkerSettingsDialog";
import { useSaveMarkerSettings, useResetMarkerSettings } from "@/hooks/useMarkerSettings";
import { useIsOrgAdmin } from "@/hooks/useIsOrgAdmin";

import { useMarkerCatalog, useRecomputeMarkers, useMarkersLastComputed, type MarkerCatalogEntry } from "@/hooks/useMarkerCatalog";
import { useCampuses } from "@/hooks/useCampuses";
import { useAuth } from "@/hooks/useAuth";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useCustomSignals, type CustomSignal } from "@/hooks/useCustomSignals";
import { CustomSignalEditorDialog } from "@/components/signals/CustomSignalEditorDialog";
import { Plus, Loader2 } from "lucide-react";

const polarityClass: Record<string, string> = {
  positive: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300",
};

function formatUpdated(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

const SignalsPage = () => {
  const { user } = useAuth();
  const [campusId, setCampusId] = useState<string | null>(null);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const { data: campuses } = useCampuses();
  const { data: members } = useOrgMembers(user?.id, !!user?.id);
  const { data: catalog, isLoading } = useMarkerCatalog({ campusId, assignedUserId });
  const recompute = useRecomputeMarkers();
  const { data: lastComputed } = useMarkersLastComputed();
  const { isOrgAdmin } = useIsOrgAdmin(user?.id);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "off" | "personal">("all");
  const [editing, setEditing] = useState<MarkerCatalogEntry | null>(null);
  const { list: customSignals } = useCustomSignals();
  const [newPersonal, setNewPersonal] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState<CustomSignal | null>(null);

  const personalSignals = useMemo(
    () => (customSignals.data || []).filter((s) => s.visibility === "personal"),
    [customSignals.data]
  );
  const hasFilters = campusId !== null || assignedUserId !== null;

  const offCount = useMemo(
    () =>
      (catalog || []).filter(
        (m) => !m.is_phase_two && m.enabled === false
      ).length,
    [catalog]
  );

  const filtered = useMemo(() => {
    if (!catalog) return [];
    if (filter === "personal") return [];
    if (filter === "off")
      return catalog.filter(
        (m) => !m.is_phase_two && m.enabled === false
      );
    const live = catalog.filter(
      (m) => !m.is_phase_two && m.enabled !== false
    );
    if (filter === "positive") return live.filter((m) => m.polarity === "positive");
    if (filter === "negative") return live.filter((m) => m.polarity === "negative");
    return live;
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
    const live = catalog.filter((m) => !m.is_phase_two && m.enabled !== false);
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
            <div className="flex items-center gap-2">
              {lastComputed && (
                <span className="hidden md:inline text-xs text-muted-foreground">
                  Updated {formatUpdated(lastComputed)}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => recompute.mutate()}
                disabled={recompute.isPending}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${recompute.isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
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
            label="Active Signals tracked"
            value={catalog?.filter((m) => !m.is_phase_two && m.enabled !== false).length || 0}
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
            {offCount > 0 && <TabsTrigger value="off">Turned off ({offCount})</TabsTrigger>}
            <TabsTrigger value="personal">
              Personal{personalSignals.length > 0 ? ` (${personalSignals.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filter === "personal" ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground max-w-2xl">
                Personal signals are yours alone — build the rules you care about without changing what the rest of your team sees.
              </p>
              <Button size="sm" className="gap-2" onClick={() => setNewPersonal(true)}>
                <Plus className="h-4 w-4" /> New personal signal
              </Button>
            </div>

            {customSignals.isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : personalSignals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-3">
                  <User className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">You don't have any personal signals yet.</p>
                  <Button size="sm" className="gap-2" onClick={() => setNewPersonal(true)}>
                    <Plus className="h-4 w-4" /> Create your first one
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {personalSignals.map((s) => (
                  <Card key={s.id} className={!s.enabled ? "opacity-60" : ""}>
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className={`text-xs ${polarityClass[s.polarity]}`}>
                            {s.polarity}
                          </Badge>
                          <p className="font-medium text-sm truncate">{s.label}</p>
                        </div>
                        {s.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                          <span>
                            {s.rule?.conditions.length || 0} condition{(s.rule?.conditions.length || 0) !== 1 ? "s" : ""} ·{" "}
                          </span>
                          {isEvaluating ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> finding people…
                            </span>
                          ) : (
                            <span>{s.contact_count || 0} {(s.contact_count || 0) === 1 ? "person" : "people"}</span>
                          )}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => setEditingPersonal(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : isLoading ? (
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
                    <MarkerRow
                      key={m.key}
                      marker={m}
                      canEdit={isOrgAdmin}
                      onEdit={() => setEditing(m)}
                    />
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

      <MarkerSettingsDialog
        marker={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />

      {(newPersonal || editingPersonal) && (
        <CustomSignalEditorDialog
          signal={editingPersonal}
          defaultVisibility="personal"
          open={newPersonal || !!editingPersonal}
          onOpenChange={(o) => {
            if (!o) {
              setNewPersonal(false);
              setEditingPersonal(null);
            }
          }}
        />
      )}
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

function MarkerRow({
  marker,
  canEdit,
  onEdit,
}: {
  marker: MarkerCatalogEntry;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const locked = marker.is_phase_two;
  const isRewritten = !!marker.promoted_signal_id;
  const isOff = marker.enabled === false;
  const save = useSaveMarkerSettings();
  const reset = useResetMarkerSettings();
  return (
    <Card className={locked || isOff ? "opacity-60" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={`text-xs ${polarityClass[marker.polarity]}`}>
                {marker.polarity}
              </Badge>
              <p className="font-medium text-sm truncate">{marker.label}</p>
              {isOff && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  Off
                </Badge>
              )}
              {isRewritten && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  Your own rule
                </Badge>
              )}
              {!isOff && !isRewritten && marker.is_customized && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  Edited
                </Badge>
              )}
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
                      {isRewritten
                        ? "Uses your church's own conditions. Open Edit to see them."
                        : markerFormula(marker.key, marker.params) || marker.description}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-2xl font-light">{marker.contact_count}</span>
              {canEdit && !locked && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      aria-label="Signal options"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                    {!isRewritten && (
                      <DropdownMenuItem
                        onClick={() =>
                          save.mutate({ markerKey: marker.key, enabled: isOff })
                        }
                      >
                        {isOff ? (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-2" /> Turn on
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5 mr-2" /> Turn off
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {marker.is_customized && (
                      <DropdownMenuItem onClick={() => reset.mutate(marker.key)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset to default
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {!locked && !isOff && marker.contact_count > 0 && (
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
