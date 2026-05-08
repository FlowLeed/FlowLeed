import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrgCheckinStats } from "@/hooks/useCheckinData";
import { useEngagementTrends, EngagementLevel } from "@/hooks/useEngagementTrends";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronRight, Hash, Percent, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Level = EngagementLevel;

const LEVELS: { key: Level; label: string; descriptor: string; goodDirection: "up" | "down" }[] = [
  { key: "highly_engaged", label: "Highly Engaged", descriptor: "Engaged, serving, connected", goodDirection: "up" },
  { key: "active", label: "Active", descriptor: "Showing up consistently", goodDirection: "up" },
  { key: "at_risk", label: "At Risk", descriptor: "Missed check-ins, fading signals", goodDirection: "down" },
  { key: "inactive", label: "Inactive", descriptor: "Needs a personal call", goodDirection: "down" },
  { key: "new", label: "New", descriptor: "Recently joined the family", goodDirection: "up" },
];

interface HeartbeatCardProps {
  campusId?: string | null;
  compact?: boolean;
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const points = useMemo(() => {
    if (values.length < 2) return null;
    const w = 56;
    const h = 18;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  if (!points) return null;
  return (
    <svg width="56" height="18" className="overflow-visible">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={positive ? "text-emerald-500" : "text-rose-500"}
      />
    </svg>
  );
}

function DeltaBadge({
  delta,
  goodDirection,
}: {
  delta: number;
  goodDirection: "up" | "down";
}) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
        <Minus className="h-3 w-3" />0
      </span>
    );
  }
  const isUp = delta > 0;
  const isGood = (isUp && goodDirection === "up") || (!isUp && goodDirection === "down");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs tabular-nums font-medium",
        isGood ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(delta)}
    </span>
  );
}

export function HeartbeatCard({ campusId, compact = false }: HeartbeatCardProps) {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const { data: stats, isLoading } = useOrgCheckinStats(orgId, campusId);
  const { data: trends } = useEngagementTrends(orgId, 30);
  const navigate = useNavigate();

  const [showAsPercent, setShowAsPercent] = useState(false);
  const [animated, setAnimated] = useState(false);
  const hasAnimatedRef = useRef(false);

  const dist = stats?.engagementDistribution || {};
  const total = LEVELS.reduce((sum, l) => sum + (dist[l.key] || 0), 0);
  const max = Math.max(1, ...LEVELS.map((l) => dist[l.key] || 0));

  useEffect(() => {
    if (!isLoading && total > 0 && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      requestAnimationFrame(() => setAnimated(true));
    }
  }, [isLoading, total]);

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Church Heartbeat
          </CardTitle>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAsPercent((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border px-2 py-1"
              aria-label="Toggle counts and percentages"
            >
              {showAsPercent ? <Percent className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
              {showAsPercent ? "Percent" : "Counts"}
            </button>
            <span className="text-sm text-muted-foreground">
              {isLoading ? "—" : `${total} ${total === 1 ? "person" : "people"}`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-5">
              {LEVELS.map((l) => (
                <div key={l.key} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No engagement data available. Sync check-ins from Planning Center to see your church's heartbeat.
            </p>
          ) : (
            <>
              {LEVELS.map((l, i) => {
                const count = dist[l.key] || 0;
                const fill = (count / max) * 100;
                const totalPct = total > 0 ? Math.round((count / total) * 100) : 0;
                const valueLabel = showAsPercent ? `${totalPct}%` : `${count}`;

                const baseline = trends?.baseline?.[l.key];
                const hasBaseline = trends?.baselineDate != null && baseline !== undefined;
                const delta = hasBaseline ? count - (baseline || 0) : 0;
                const sparkValues = (trends?.series || []).map((p) => p.counts[l.key] || 0);
                const sparkPositive =
                  sparkValues.length >= 2
                    ? l.goodDirection === "up"
                      ? sparkValues[sparkValues.length - 1] >= sparkValues[0]
                      : sparkValues[sparkValues.length - 1] <= sparkValues[0]
                    : true;

                return (
                  <Tooltip key={l.key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => navigate(`/contacts?engagementLevel=${l.key}`)}
                        className="w-full text-left group rounded-md -mx-2 px-2 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-baseline justify-between mb-2 gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-foreground">{l.label}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {valueLabel}
                            </span>
                            {hasBaseline && (
                              <DeltaBadge delta={delta} goodDirection={l.goodDirection} />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {sparkValues.length >= 2 && (
                              <Sparkline values={sparkValues} positive={sparkPositive} />
                            )}
                            <span className="hidden sm:inline">{l.descriptor}</span>
                            <ChevronRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full bg-primary rounded-full",
                              "transition-[width] duration-700 ease-out"
                            )}
                            style={{
                              width: animated ? `${fill}%` : "0%",
                              transitionDelay: `${i * 80}ms`,
                            }}
                          />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-xs">
                        <div className="font-medium">{l.label}</div>
                        <div className="text-muted-foreground">
                          {count} {count === 1 ? "person" : "people"} · {totalPct}% of scored
                        </div>
                        {hasBaseline && (
                          <div className="text-muted-foreground">
                            {delta === 0
                              ? "No change vs 30 days ago"
                              : `${delta > 0 ? "+" : ""}${delta} vs 30 days ago`}
                          </div>
                        )}
                        <div className="text-muted-foreground mt-0.5">Click to view</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              <div className="pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                <span>Trends compared to 30 days ago · based on check-in history</span>
                <span className="tabular-nums">
                  {total} scored {total === 1 ? "person" : "people"}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
