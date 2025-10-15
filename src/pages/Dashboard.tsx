import React from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useMyContactsNeedingAttention } from "@/hooks/useMyContactsNeedingAttention";
import { useMyUpcomingTasks } from "@/hooks/useMyUpcomingTasks";
import { useTeamActivityFeed } from "@/hooks/useTeamActivityFeed";
import { useMyFlows } from "@/hooks/useMyFlows";
import { PersonalMetrics } from "@/components/dashboard/PersonalMetrics";
import { ContactsNeedingAttention } from "@/components/dashboard/ContactsNeedingAttention";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import { TeamActivityFeed } from "@/components/dashboard/TeamActivityFeed";
import { MyFlowsQuickAccess } from "@/components/dashboard/MyFlowsQuickAccess";

const Dashboard = () => {
  const { user } = useAuth();
  const { profile, organization } = useProfile();
  
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics(user?.id);
  const { data: contactsNeedingAttention, isLoading: contactsLoading } = 
    useMyContactsNeedingAttention(user?.id);
  const { data: upcomingTasks, isLoading: tasksLoading } = useMyUpcomingTasks(user?.id);
  const { data: teamActivity, isLoading: activityLoading } = 
    useTeamActivityFeed(organization?.id);
  const { data: myFlows, isLoading: flowsLoading } = useMyFlows(user?.id);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" showAddButton={false} showFlowIcon={false} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Personal Greeting */}
          <div className="space-y-1">
            <h1 className="text-3xl font-light">
              Welcome back, {profile?.full_name || "there"}!
            </h1>
            <p className="text-sm text-muted-foreground">{currentDate}</p>
          </div>

          {/* Personal Metrics */}
          <PersonalMetrics
            metrics={metrics || { myContacts: 0, myInteractions: 0, pendingTasks: 0, peopleNeedingAttention: 0 }}
            loading={metricsLoading}
          />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* People Needing Attention */}
            <ContactsNeedingAttention
              contacts={contactsNeedingAttention || []}
              loading={contactsLoading}
            />

            {/* Upcoming Tasks */}
            <UpcomingTasks
              tasks={upcomingTasks || []}
              loading={tasksLoading}
            />
          </div>

          {/* Team Activity Feed */}
          <TeamActivityFeed
            activities={teamActivity || []}
            loading={activityLoading}
          />

          {/* My Flows Quick Access */}
          <MyFlowsQuickAccess
            flows={myFlows || []}
            loading={flowsLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
