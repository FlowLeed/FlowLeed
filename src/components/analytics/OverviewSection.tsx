import { Users, UserPlus, Workflow, MessageSquare, UsersRound } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { useOverviewMetrics, DateRange } from "@/hooks/useAnalytics";

interface OverviewSectionProps {
  dateRange: DateRange;
  campusId?: string | null;
}

export const OverviewSection = ({ dateRange, campusId }: OverviewSectionProps) => {
  const { data: metrics, isLoading } = useOverviewMetrics(dateRange, campusId);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total People"
          value={metrics?.totalContacts || 0}
          icon={Users}
          loading={isLoading}
          description="All people in organization"
        />
        <MetricCard
          title="People Added"
          value={metrics?.contactsAdded || 0}
          icon={UserPlus}
          loading={isLoading}
          description="New people in period"
        />
        <MetricCard
          title="Active Flows"
          value={metrics?.activeFlows || 0}
          icon={Workflow}
          loading={isLoading}
          description="Flows with people"
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
