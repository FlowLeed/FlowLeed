import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Pencil, Trash2, Wand2, RefreshCw } from "lucide-react";
import { useCustomSignals, type CustomSignal } from "@/hooks/useCustomSignals";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CustomSignalEditorDialog } from "@/components/signals/CustomSignalEditorDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const polarityClass: Record<string, string> = {
  positive: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300",
};

const CustomSignalsPage = () => {
  const { list, update, remove, isEvaluating } = useCustomSignals();
  const { organization } = useProfile();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CustomSignal | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const handleRecompute = async () => {
    if (!organization?.id) return;
    setRecomputing(true);
    try {
      const { data, error } = await supabase.functions.invoke("evaluate-custom-signals", {
        body: { organization_id: organization.id },
      });
      if (error) throw error;
      toast.success(`Recomputed: ${data?.matched ?? 0} matches across ${data?.signals ?? 0} signals`);
      qc.invalidateQueries({ queryKey: ["custom-signals", organization.id] });
    } catch (e: any) {
      toast.error(e.message || "Failed to recompute");
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Custom Signals"
        titleBadge={
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-purple-500/50 text-purple-600 dark:text-purple-400">
            Beta
          </Badge>
        }
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/signals" className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={handleRecompute} disabled={recomputing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${recomputing ? "animate-spin" : ""}`} /> Recompute
            </Button>
            <Button size="sm" onClick={() => setIsNew(true)} className="gap-2">
              <Plus className="h-4 w-4" /> New signal
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Build your own signals with AND/OR rules combining attendance, groups, serving, flows, tags, and PCO fields. Custom signals appear on contact profiles alongside built-in markers, and can trigger the AI Signal Agent.
        </p>

        {list.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : !list.data?.length ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Wand2 className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No custom signals yet.</p>
              <Button size="sm" onClick={() => setIsNew(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Create your first signal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.data.map((s) => (
              <Card key={s.id} className={!s.enabled ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={`text-xs ${polarityClass[s.polarity]}`}>
                          {s.polarity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{s.severity}</Badge>
                        {s.visibility === "personal" && (
                          <Badge variant="secondary" className="text-[10px]">Only me</Badge>
                        )}
                        <p className="font-medium text-sm truncate">{s.label}</p>
                      </div>
                      {s.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                        <span>
                          {s.rule?.conditions.length || 0} condition{(s.rule?.conditions.length || 0) !== 1 ? "s" : ""} ·{" "}
                        </span>
                        {isEvaluating || recomputing ? (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3 animate-spin" /> finding contacts…
                          </span>
                        ) : (
                          <span>{s.contact_count || 0} contact{s.contact_count !== 1 ? "s" : ""}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(v) => update.mutate({ id: s.id, enabled: v })}
                      />
                      <div className="flex items-center gap-1">
                        {!isEvaluating && !recomputing && (s.contact_count || 0) > 0 && (
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            <Link to={`/contacts?marker=signal:${s.id}`}>View</Link>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{s.label}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This signal and all its matches will be removed. This can't be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove.mutate(s.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {(isNew || editing) && (
        <CustomSignalEditorDialog
          signal={editing}
          open={isNew || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setIsNew(false);
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default CustomSignalsPage;
