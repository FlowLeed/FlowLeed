import { useFlowAnalytics } from "@/hooks/useAnalytics";
import { MetricCard } from "@/components/analytics/MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CheckCircle2, Clock, AlertTriangle, TrendingUp, Activity } from "lucide-react";

interface FlowMetricsBarProps {
  flowId: string;
}

export const FlowMetricsBar = ({ flowId }: FlowMetricsBarProps) => {
  const { data: flows, isLoading } = useFlowAnalytics();

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
    );
  }

  const flow = flows?.find((f) => f.id === flowId);
  if (!flow) return null;

  const completion = typeof flow.completionRate === "number" ? flow.completionRate : 0;
  const avgTime = typeof flow.avgTimeInFlow === "number" ? flow.avgTimeInFlow : null;
  const lift = typeof flow.engagementLift === "number" ? flow.engagementLift : null;

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-4">
      <MetricCard title="Active in Flow" value={flow.activePeople ?? 0} icon={Users} />
      <MetricCard title="Completed" value={flow.endCount ?? 0} icon={CheckCircle2} />
      <MetricCard title="Completion %" value={`${completion.toFixed(1)}%`} icon={Activity} />
      <MetricCard
        title="Avg Time to Complete"
        value={avgTime !== null ? `${avgTime.toFixed(1)}d` : "N/A"}
        icon={Clock}
      />
      <MetricCard
        title="People Stalled"
        value={flow.peopleStalled ?? 0}
        icon={AlertTriangle}
        description="No stage change in 30+ days"
      />
      <MetricCard
        title="Engagement Lift"
        value={lift === null ? "N/A" : `${lift >= 0 ? "+" : ""}${lift.toFixed(1)}`}
        icon={TrendingUp}
        description="Completed avg − Entry avg"
      />
    </div>
  );
};
