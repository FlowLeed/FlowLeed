import { useState } from "react";
import { Link } from "react-router-dom";
import { format, isPast, isToday } from "date-fns";
import { MoreVertical, Plus, Trash2, Sparkles } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTasks, useTaskMutations, Task } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const dueLabel = (due: string) => {
  const d = new Date(due);
  if (isToday(d)) return "Today";
  return format(d, "MMM d");
};

const TaskRow = ({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) => {
  const done = !!task.completed_at;
  const overdue = !done && task.due_at && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at));
  const meta = [task.contact?.name, task.due_at ? dueLabel(task.due_at) : null].filter(Boolean);
  return (
    <div className="flex items-start gap-3 px-1 py-2.5">
      <Checkbox checked={done} onCheckedChange={onToggle} className="mt-0.5 h-4 w-4 rounded" aria-label={done ? "Mark not done" : "Mark done"} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium leading-5", done && "text-muted-foreground line-through")}>{task.title}</p>
        {task.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
        {meta.length > 0 && (
          <p className={cn("mt-0.5 text-xs text-muted-foreground", overdue && "text-destructive")}>
            {task.contact ? <Link to={`/contacts/${task.contact.id}`} className="hover:underline">{task.contact.name}</Link> : null}
            {task.contact && task.due_at ? " · " : null}
            {task.due_at ? (overdue ? `Overdue · ${dueLabel(task.due_at)}` : dueLabel(task.due_at)) : null}
          </p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Task options">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onToggle}>{done ? "Mark not done" : "Mark done"}</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const TasksPage = () => {
  const { user } = useAuth();
  const { organization } = useProfile();
  const { data: tasks, isLoading } = useTasks(user?.id);
  const { toggle, remove, create } = useTaskMutations(user?.id);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");

  const openTasks = (tasks || []).filter((t) => !t.completed_at);
  const doneTasks = (tasks || []).filter((t) => t.completed_at);

  const save = async () => {
    if (!title.trim() || !organization?.id) return;
    try {
      await create.mutateAsync({
        organization_id: organization.id,
        title: title.trim(),
        description: description.trim() || null,
        due_at: due ? new Date(`${due}T12:00:00`).toISOString() : null,
      });
      setTitle(""); setDescription(""); setDue(""); setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Could not save task");
    }
  };

  const renderList = (list: Task[]) => (
    <div className="divide-y">
      {list.map((t) => (
        <TaskRow key={t.id} task={t} onToggle={() => toggle.mutate(t)} onDelete={() => remove.mutate(t.id)} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="Tasks" showFlowIcon={false} showAddButton={false} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-2xl mx-auto px-5 py-4 pb-24">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold">My tasks {openTasks.length > 0 && <span className="text-muted-foreground font-normal">({openTasks.length})</span>}</h2>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New task</Button>
          </div>

          {isLoading ? (
            <div className="space-y-3 pt-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : openTasks.length === 0 && doneTasks.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <p>No tasks yet.</p>
              <p className="text-sm flex items-center justify-center gap-1"><Sparkles className="h-4 w-4" />Tip: ask FlowLeed AI “Remind me to call John on Friday”.</p>
            </div>
          ) : (
            <>
              {openTasks.length > 0 ? renderList(openTasks) : <p className="py-8 text-center text-muted-foreground">All caught up.</p>}
              {doneTasks.length > 0 && (
                <div className="mt-8">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed</p>
                  {renderList(doneTasks)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input autoFocus placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
            <Textarea placeholder="Details (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={!title.trim() || create.isPending}>{create.isPending ? "Saving..." : "Add task"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TasksPage;
