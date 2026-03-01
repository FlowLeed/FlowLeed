import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useTasksPageData } from "@/hooks/useTasksPageData";
import { TaskContactRow } from "@/components/tasks/TaskContactRow";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";

const TasksPage = () => {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: needingAttention, isLoading: loadingAttention } = useTasksPageData(user?.id);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Tasks"
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add to Flow
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
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
        </div>
      </div>

      <CreateTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
};

export default TasksPage;
