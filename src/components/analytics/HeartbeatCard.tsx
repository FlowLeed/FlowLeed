import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrgCheckinStats } from "@/hooks/useCheckinData";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronRight, Hash, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

type Level = "highly_engaged" | "active" | "at_risk" | "inactive" | "new";

const LEVELS: { key: Level; label: string; descriptor: string }[] = [
  { key: "highly_engaged", label: "Highly Engaged", descriptor: "Engaged, serving, connected" },
  { key: "active", label: "Active", descriptor: "Showing up consistently" },
  { key: "at_risk", label: "At Risk", descriptor: "Missed check-ins, fading signals" },
  { key: "inactive", label: "Inactive", descriptor: "Needs a personal call" },
  { key: "new", label: "New", descriptor: "Recently joined the family" },
];

interface HeartbeatCardProps {
  campusId?: string | null;
}

export function HeartbeatCard({ campusId }: HeartbeatCardProps) {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const { data: stats, isLoading } = useOrgCheckinStats(orgId, campusId);
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
      // next tick so the 0%-width paints first
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
                return (
                  <Tooltip key={l.key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => navigate(`/contacts?engagementLevel=${l.key}`)}
                        className="w-full text-left group rounded-md -mx-2 px-2 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-baseline justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{l.label}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {valueLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <span>{l.descriptor}</span>
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
                        <div className="text-muted-foreground mt-0.5">Click to view</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              <div className="pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                <span>Based on check-in history (last 90 days)</span>
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
