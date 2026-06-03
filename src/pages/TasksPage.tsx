import { Header } from "@/components/layout/Header";
import { Users, CalendarCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useTasksPageData, useAllScheduledTasks } from "@/hooks/useTasksPageData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { TaskContactRow } from "@/components/tasks/TaskContactRow";
import { ScheduledTaskItem } from "@/components/tasks/ScheduledTaskItem";
import { PersonalMetrics } from "@/components/dashboard/PersonalMetrics";
import { TeamActivityFeed } from "@/components/dashboard/TeamActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TasksPage = () => {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: needingAttention, isLoading: loadingAttention } = useTasksPageData(user?.id);
  const { data: scheduledTasks, isLoading: loadingScheduled } = useAllScheduledTasks(user?.id);
  const { data: dashboardData, isLoading: loadingDashboard } = useDashboardData(user?.id);

  const pendingTasks = scheduledTasks?.filter((t) => !t.completed_at) || [];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Tasks"
        showFlowIcon={false}
        showAddButton={false}
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Personal Metrics */}
          <PersonalMetrics
            metrics={dashboardData?.metrics || { myContacts: 0, myInteractions: 0, pendingTasks: 0, peopleNeedingAttention: 0 }}
            loading={loadingDashboard}
          />

          {/* My Upcoming Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg font-light">My Upcoming Tasks</CardTitle>
                {pendingTasks.length > 0 && (
                  <span className="text-sm text-muted-foreground">({pendingTasks.length})</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingScheduled ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming tasks scheduled.</p>
              ) : (
                <div className="space-y-1">
                  {pendingTasks.slice(0, 10).map((task) => (
                    <ScheduledTaskItem key={task.id} task={task} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* People I Need to Connect With */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-light">People I Need to Connect With</h2>
              {needingAttention && needingAttention.length > 0 && (
                <span className="text-sm text-muted-foreground">({needingAttention.length})</span>
              )}
            </div>
            {loadingAttention ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !needingAttention || needingAttention.length === 0 ? (
              <div className="border rounded-lg p-6 text-center">
                <p className="text-muted-foreground">You're all caught up! No one needs immediate attention. 🎉</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {needingAttention.map((contact) => (
                  <TaskContactRow key={contact.id} contact={contact} />
                ))}
              </div>
            )}
          </section>

          {/* Team Activity Feed */}
          <TeamActivityFeed
            activities={dashboardData?.activityFeed || []}
            loading={loadingDashboard}
          />
        </div>
      </div>

      <CreateTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
};

export default TasksPage;
