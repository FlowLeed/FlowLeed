import { Users, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { MetricCard } from "@/components/analytics/MetricCard";
import { Skeleton } from "@/components/ui/skeleton";

interface PersonalMetricsProps {
  metrics: {
    myContacts: number;
    myInteractions: number;
    pendingTasks: number;
    peopleNeedingAttention: number;
  };
  loading?: boolean;
}

export const PersonalMetrics = ({ metrics, loading }: PersonalMetricsProps) => {
  // PHASE 4: Show skeleton loaders while loading
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 border rounded-lg bg-card">
            <Skeleton className="h-4 w-24 mb-4" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
        <p className="text-sm text-amber-800">
          Unable to load metrics. Please refresh the page.
        </p>
      </div>
    );
  }
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="My Contacts"
        value={metrics.myContacts}
        icon={Users}
        loading={false}
        description="Assigned to me"
      />
      <MetricCard
        title="My Interactions"
        value={metrics.myInteractions}
        icon={MessageSquare}
        loading={false}
        description="This month"
      />
      <MetricCard
        title="Pending Tasks"
        value={metrics.pendingTasks}
        icon={CheckCircle2}
        loading={false}
        description="Upcoming follow-ups"
      />
      <MetricCard
        title="Need Attention"
        value={metrics.peopleNeedingAttention}
        icon={AlertCircle}
        loading={false}
        description="5+ days inactive"
      />
    </div>
  );
};
