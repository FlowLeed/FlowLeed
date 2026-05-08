import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgCheckinStats } from "@/hooks/useCheckinData";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";

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

  const dist = stats?.engagementDistribution || {};
  const total = LEVELS.reduce((sum, l) => sum + (dist[l.key] || 0), 0);
  const max = Math.max(1, ...LEVELS.map((l) => dist[l.key] || 0));

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Church Heartbeat
        </CardTitle>
        <span className="text-sm text-muted-foreground">
          {isLoading ? "—" : `${total} ${total === 1 ? "person" : "people"}`}
        </span>
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
          LEVELS.map((l) => {
            const count = dist[l.key] || 0;
            const pct = (count / max) * 100;
            const totalPct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => navigate(`/contacts?engagementLevel=${l.key}`)}
                className="w-full text-left group rounded-md -mx-2 px-2 py-1 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{l.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {count} · {totalPct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span>{l.descriptor}</span>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
