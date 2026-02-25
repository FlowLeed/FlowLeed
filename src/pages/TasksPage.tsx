import { useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Plus, Users, ListChecks } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useTasksPageData } from "@/hooks/useTasksPageData";
import { useAllScheduledTasks } from "@/hooks/useTasksPageData";
import { TaskContactRow } from "@/components/tasks/TaskContactRow";
import { ScheduledTaskItem } from "@/components/tasks/ScheduledTaskItem";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";

const TasksPage = () => {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [taskTab, setTaskTab] = useState("upcoming");

  const { data: needingAttention, isLoading: loadingAttention } = useTasksPageData(user?.id);
  const { data: allTasks, isLoading: loadingTasks } = useAllScheduledTasks(user?.id);

  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    const now = new Date();
    switch (taskTab) {
      case "upcoming":
        return allTasks.filter((t) => !t.completed_at && new Date(t.scheduled_at!) >= now);
      case "overdue":
        return allTasks.filter((t) => !t.completed_at && new Date(t.scheduled_at!) < now);
      case "completed":
        return allTasks.filter((t) => !!t.completed_at);
      default:
        return allTasks;
    }
  }, [allTasks, taskTab]);

  const overduCount = useMemo(
    () => allTasks?.filter((t) => !t.completed_at && new Date(t.scheduled_at!) < new Date()).length || 0,
    [allTasks]
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Tasks"
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Section 1: People I Need to Connect With */}
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

          {/* Section 2: Scheduled Follow-Ups */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-light">Scheduled Follow-Ups</h2>
            </div>
            <Tabs value={taskTab} onValueChange={setTaskTab}>
              <TabsList>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="overdue">
                  Overdue{overduCount > 0 && ` (${overduCount})`}
                </TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
              <TabsContent value={taskTab}>
                {loadingTasks ? (
                  <div className="space-y-3 mt-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="border rounded-lg p-6 text-center mt-3">
                    <p className="text-muted-foreground">
                      {taskTab === "upcoming" && "No upcoming tasks. Create one to stay on track!"}
                      {taskTab === "overdue" && "No overdue tasks — great job! ✅"}
                      {taskTab === "completed" && "No completed tasks yet."}
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y mt-3">
                    {filteredTasks.map((task) => (
                      <ScheduledTaskItem key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>

      <CreateTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
};

export default TasksPage;
