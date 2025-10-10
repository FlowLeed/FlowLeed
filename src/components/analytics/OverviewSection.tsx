import { Users, UserPlus, Workflow, MessageSquare, UsersRound } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { useOverviewMetrics, DateRange } from "@/hooks/useAnalytics";

interface OverviewSectionProps {
  dateRange: DateRange;
}

export const OverviewSection = ({ dateRange }: OverviewSectionProps) => {
  const { data: metrics, isLoading } = useOverviewMetrics(dateRange);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Contacts"
          value={metrics?.totalContacts || 0}
          icon={Users}
          loading={isLoading}
          description="All contacts in organization"
        />
        <MetricCard
          title="Contacts Added"
          value={metrics?.contactsAdded || 0}
          icon={UserPlus}
          loading={isLoading}
          description="New contacts in period"
        />
        <MetricCard
          title="Active Flows"
          value={metrics?.activeFlows || 0}
          icon={Workflow}
          loading={isLoading}
          description="Flows with contacts"
        />
        <MetricCard
          title="Total Interactions"
          value={metrics?.totalInteractions || 0}
          icon={MessageSquare}
          loading={isLoading}
          description="Logged interactions"
        />
        <MetricCard
          title="Active Team Members"
          value={metrics?.activeTeamMembers || 0}
          icon={UsersRound}
          loading={isLoading}
          description="Members with activity"
        />
      </div>
    </div>
  );
};
