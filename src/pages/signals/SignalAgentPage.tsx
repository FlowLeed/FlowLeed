import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Bot, Check, X, Bell, GitBranch, ListChecks, MessageSquare, Sparkles, Play, Loader2 } from "lucide-react";
import { useAgentSuggestions, useAgentConfig, type AgentActionType } from "@/hooks/useSignalAgent";
import { useMarkerCatalog } from "@/hooks/useMarkerCatalog";
import { useCustomSignals } from "@/hooks/useCustomSignals";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const ACTION_ICON: Record<AgentActionType, any> = {
  notify: Bell,
  add_to_flow: GitBranch,
  create_task: ListChecks,
  draft_message: MessageSquare,
};

const ACTION_LABEL: Record<AgentActionType, string> = {
  notify: "Notify leader",
  add_to_flow: "Add to flow",
  create_task: "Create task",
  draft_message: "Draft message",
};

const SignalAgentPage = () => {
  const [tab, setTab] = useState<"queue" | "settings">("queue");
  const [running, setRunning] = useState(false);
  const { list: pending, review } = useAgentSuggestions("pending");
  const { query: config, save } = useAgentConfig();
  const { data: markers } = useMarkerCatalog();
  const liveMarkers = (markers || []).filter((m) => !m.is_phase_two && m.enabled !== false);
  const { list: customSignals } = useCustomSignals();
  const qc = useQueryClient();

  const watched = config.data?.watch_signals || [];
  const toggleWatch = (key: string) => {
    const next = watched.includes(key) ? watched.filter((k) => k !== key) : [...watched, key];
    save.mutate({ watch_signals: next });
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("signal-agent-run", { body: {} });
      if (error) throw error;
      toast.success(`Agent run complete — ${data?.suggestions_created ?? 0} new suggestion(s)`);
      qc.invalidateQueries({ queryKey: ["signal-agent-suggestions"] });
    } catch (e: any) {
      toast.error(e.message || "Agent run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="AI Signal Agent"
        titleBadge={
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-purple-500/50 text-purple-600 dark:text-purple-400">
            <Sparkles className="h-3 w-3 mr-1" /> Suggests only
          </Badge>
        }
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleRunNow} disabled={running || !config.data?.enabled} className="gap-1">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run agent now
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/signals" className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          The agent watches your signals and proposes actions. Nothing happens without your approval — every suggestion needs a human decision.
        </p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="queue">
              Review queue
              {pending.data?.length ? (
                <Badge variant="secondary" className="ml-2 h-5 text-[10px]">{pending.data.length}</Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-3">
            {pending.isLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : !pending.data?.length ? (
              <Card>
                <CardContent className="py-12 text-center space-y-3">
                  <Bot className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No suggestions pending.</p>
                  <p className="text-xs text-muted-foreground">
                    When the agent runs, proposals will appear here for you to approve or dismiss.
                  </p>
                </CardContent>
              </Card>
            ) : (
              pending.data.map((s) => {
                const Icon = ACTION_ICON[s.action_type];
                return (
                  <Card key={s.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{ACTION_LABEL[s.action_type]}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{s.signal_key}</Badge>
                            {s.confidence !== null && (
                              <Badge variant="outline" className="text-[10px]">
                                {Math.round((s.confidence || 0) * 100)}% confidence
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <Link
                            to={`/contacts/${s.contact_id}`}
                            className="text-sm font-medium hover:underline block"
                          >
                            {s.contact?.first_name} {s.contact?.last_name}
                          </Link>
                          {s.reasoning && (
                            <p className="text-sm text-muted-foreground">{s.reasoning}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => review.mutate({ id: s.id, decision: "approved" })}
                            disabled={review.isPending}
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => review.mutate({ id: s.id, decision: "dismissed" })}
                            disabled={review.isPending}
                          >
                            <X className="h-3.5 w-3.5" /> Dismiss
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Enable AI Signal Agent</p>
                    <p className="text-xs text-muted-foreground">
                      The agent scans signals daily and after real-time changes, then posts suggestions here.
                    </p>
                  </div>
                  <Switch
                    checked={!!config.data?.enabled}
                    onCheckedChange={(v) => save.mutate({ enabled: v })}
                  />
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label>Allowed action types</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["notify", "add_to_flow", "create_task", "draft_message"] as AgentActionType[]).map((a) => {
                      const enabled = config.data?.allowed_actions?.includes(a);
                      return (
                        <Button
                          key={a}
                          size="sm"
                          variant={enabled ? "default" : "outline"}
                          onClick={() => {
                            const current = config.data?.allowed_actions || ["notify"];
                            const next = enabled ? current.filter((x) => x !== a) : [...current, a];
                            save.mutate({ allowed_actions: next });
                          }}
                        >
                          {ACTION_LABEL[a]}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <Label>Watched signals</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pick the signals the agent should monitor. Only contacts matching these will generate suggestions.
                    </p>
                  </div>

                  {(markers?.length ?? 0) > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Built-in markers</p>
                      <div className="flex flex-wrap gap-1.5">
                        {markers!.map((m) => {
                          const on = watched.includes(m.key);
                          return (
                            <Button
                              key={m.key}
                              size="sm"
                              variant={on ? "default" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => toggleWatch(m.key)}
                            >
                              {on && <Check className="h-3 w-3 mr-1" />}
                              {m.label}
                              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{m.contact_count}</Badge>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(customSignals.data?.length ?? 0) > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Custom signals</p>
                      <div className="flex flex-wrap gap-1.5">
                        {customSignals.data!.map((s) => {
                          const key = `custom:${s.id}`;
                          const on = watched.includes(key);
                          return (
                            <Button
                              key={s.id}
                              size="sm"
                              variant={on ? "default" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => toggleWatch(key)}
                              disabled={!s.enabled}
                            >
                              {on && <Check className="h-3 w-3 mr-1" />}
                              {s.label}
                              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{s.contact_count ?? 0}</Badge>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!markers?.length && !customSignals.data?.length && (
                    <p className="text-xs text-muted-foreground">No signals available yet.</p>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label>Max suggestions per day</Label>
                  <Input
                    type="number"
                    className="w-32"
                    value={config.data?.max_suggestions_per_day ?? 25}
                    onChange={(e) => save.mutate({ max_suggestions_per_day: parseInt(e.target.value) || 25 })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Quiet hours start</Label>
                    <Input
                      type="time"
                      value={config.data?.quiet_hours?.start ?? "21:00"}
                      onChange={(e) =>
                        save.mutate({
                          quiet_hours: {
                            ...(config.data?.quiet_hours ?? { start: "21:00", end: "08:00" }),
                            start: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quiet hours end</Label>
                    <Input
                      type="time"
                      value={config.data?.quiet_hours?.end ?? "08:00"}
                      onChange={(e) =>
                        save.mutate({
                          quiet_hours: {
                            ...(config.data?.quiet_hours ?? { start: "21:00", end: "08:00" }),
                            end: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SignalAgentPage;
