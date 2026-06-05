import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Lock, ArrowRight, Activity, TrendingDown, Sparkles } from "lucide-react";
import { useMarkerCatalog, useRecomputeMarkers, type MarkerCatalogEntry } from "@/hooks/useMarkerCatalog";

const polarityClass: Record<string, string> = {
  positive: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300",
};

const SignalsPage = () => {
  const { data: catalog, isLoading } = useMarkerCatalog();
  const recompute = useRecomputeMarkers();
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "phase2">("all");

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
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
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
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
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
            <span className="text-2xl font-light">{marker.contact_count}</span>
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
