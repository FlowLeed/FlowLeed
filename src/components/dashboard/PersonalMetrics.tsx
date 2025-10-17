import { Users, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { MetricCard } from "@/components/analytics/MetricCard";

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
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="My Contacts"
        value={metrics.myContacts}
        icon={Users}
        loading={loading}
        description="Assigned to me"
      />
      <MetricCard
        title="My Interactions"
        value={metrics.myInteractions}
        icon={MessageSquare}
        loading={loading}
        description="This month"
      />
      <MetricCard
        title="Pending Tasks"
        value={metrics.pendingTasks}
        icon={CheckCircle2}
        loading={loading}
        description="Upcoming follow-ups"
      />
      <MetricCard
        title="Need Attention"
        value={metrics.peopleNeedingAttention}
        icon={AlertCircle}
        loading={loading}
        description="5+ days inactive"
      />
    </div>
  );
};
