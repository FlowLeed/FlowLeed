import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyAssignedContacts } from "@/hooks/useMyAssignedContacts";
import { useDashboardData } from "@/hooks/useDashboardData";
import { TaskContactRow } from "@/components/tasks/TaskContactRow";
import { PersonalMetrics } from "@/components/dashboard/PersonalMetrics";
import { MyContactsFilters, SortKey } from "@/components/tasks/MyContactsFilters";

const TasksPage = () => {
  const { user } = useAuth();
  const { data: contacts, isLoading } = useMyAssignedContacts(user?.id);
  const { data: dashboardData, isLoading: loadingDashboard } = useDashboardData(user?.id);

  const [search, setSearch] = useState("");
  const [flow, setFlow] = useState("all");
  const [stage, setStage] = useState("all");
  const [campus, setCampus] = useState("all");
  const [sort, setSort] = useState<SortKey>("last_contact");

  const flowOptions = useMemo(() => {
    const map = new Map<string, string>();
    (contacts || []).forEach((c) => { if (c.flowId && c.flowName) map.set(c.flowId, c.flowName); });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [contacts]);

  const stageOptions = useMemo(() => {
    const map = new Map<string, string>();
    (contacts || [])
      .filter((c) => flow === "all" || c.flowId === flow)
      .forEach((c) => { if (c.stageId && c.stageName) map.set(c.stageId, c.stageName); });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [contacts, flow]);

  const campusOptions = useMemo(() => {
    const map = new Map<string, string>();
    (contacts || []).forEach((c) => { if (c.campusId && c.campusName) map.set(c.campusId, c.campusName); });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [contacts]);

  const filtered = useMemo(() => {
    let list = contacts || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (flow !== "all") list = list.filter((c) => c.flowId === flow);
    if (stage !== "all") list = list.filter((c) => c.stageId === stage);
    if (campus !== "all") list = list.filter((c) => c.campusId === campus);

    const sorted = [...list];
    if (sort === "last_contact") {
      sorted.sort((a, b) => b.daysSinceLastContact - a.daysSinceLastContact);
    } else if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "recent") {
      sorted.sort((a, b) => {
        const ta = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
        const tb = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
        return tb - ta;
      });
    }
    return sorted;
  }, [contacts, search, flow, stage, campus, sort]);

  const hasActiveFilters = !!search || flow !== "all" || stage !== "all" || campus !== "all";
  const clearFilters = () => { setSearch(""); setFlow("all"); setStage("all"); setCampus("all"); };

  return (
    <div className="flex flex-col h-full">
      <Header title="Tasks" showFlowIcon={false} showAddButton={false} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <PersonalMetrics
            metrics={dashboardData?.metrics || { myContacts: 0, myInteractions: 0, pendingTasks: 0, peopleNeedingAttention: 0 }}
            loading={loadingDashboard}
          />

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-light">My Contacts</h2>
              {contacts && contacts.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({filtered.length}{filtered.length !== contacts.length ? ` of ${contacts.length}` : ""})
                </span>
              )}
            </div>

            <div className="mb-4">
              <MyContactsFilters
                search={search} onSearchChange={setSearch}
                flow={flow} onFlowChange={(v) => { setFlow(v); setStage("all"); }}
                stage={stage} onStageChange={setStage}
                campus={campus} onCampusChange={setCampus}
                sort={sort} onSortChange={setSort}
                flowOptions={flowOptions}
                stageOptions={stageOptions}
                campusOptions={campusOptions}
                hasActiveFilters={hasActiveFilters}
                onClear={clearFilters}
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !contacts || contacts.length === 0 ? (
              <div className="border rounded-lg p-6 text-center">
                <p className="text-muted-foreground">No contacts assigned to you yet.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="border rounded-lg p-6 text-center space-y-3">
                <p className="text-muted-foreground">No contacts match your filters.</p>
                <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {filtered.map((contact) => (
                  <TaskContactRow key={contact.id} contact={contact} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default TasksPage;
