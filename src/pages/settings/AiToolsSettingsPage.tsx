import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, LockKeyhole, ShieldCheck } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsOrgAdmin } from "@/hooks/useIsOrgAdmin";
import { useProfile } from "@/hooks/useProfile";
import { AI_MASTER_TOOL_KEY, AI_TOOL_GROUPS, AI_TOOLS } from "@/lib/aiTools";
import { toast } from "sonner";

type SettingRow = { tool_key: string; enabled: boolean };

export const AiToolsSettingsContent = () => {
  const { user } = useAuth();
  const { organization } = useProfile();
  const { isOrgAdmin, isLoading: adminLoading } = useIsOrgAdmin(user?.id);
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ai-tool-settings", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_tool_settings")
        .select("tool_key, enabled")
        .eq("organization_id", organization?.id ?? "");
      if (error) throw error;
      return (data ?? []) as SettingRow[];
    },
  });

  const settings = useMemo(() => new Map(rows.map((row) => [row.tool_key, row.enabled])), [rows]);
  const masterEnabled = settings.get(AI_MASTER_TOOL_KEY) ?? true;

  const updateSetting = useMutation({
    mutationFn: async ({ key, enabled, safety }: { key: string; enabled: boolean; safety: string }) => {
      if (!organization?.id || !user?.id) throw new Error("Organization not available");
      const { error } = await supabase.from("ai_tool_settings").upsert({
        organization_id: organization.id,
        tool_key: key,
        enabled,
        safety_level: safety,
        updated_by_user_id: user.id,
      }, { onConflict: "organization_id,tool_key" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-tool-settings", organization?.id] }),
    onError: (error: Error) => toast.error("Could not update AI tools", { description: error.message }),
  });

  const setTool = (key: string, enabled: boolean, safety: string) => updateSetting.mutate({ key, enabled, safety });

  return (
      <div className="w-full space-y-6">
        <section className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div>
            <div>
              <h1 className="text-2xl font-semibold">FlowLeed AI Tools</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Choose what FlowLeed AI can read and what actions it may prepare for confirmation.</p>
            </div>
          </div>
          <div className="flex min-h-11 items-center gap-3">
            <span className="text-sm font-medium">Allow AI tools</span>
            <Switch checked={masterEnabled} disabled={!isOrgAdmin || isLoading || adminLoading || updateSetting.isPending} onCheckedChange={(enabled) => setTool(AI_MASTER_TOOL_KEY, enabled, "read")} aria-label="Allow FlowLeed AI tools" />
          </div>
        </section>

        {!isOrgAdmin && !adminLoading && (
          <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>You can see which tools are available. An organization owner or admin can change them.</p>
          </div>
        )}

        {AI_TOOL_GROUPS.map((group) => {
          const tools = AI_TOOLS.filter((tool) => tool.safety === group.safety);
          if (tools.length === 0) return null;
          return (
            <section key={group.safety} className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">{group.label}</h2>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </div>
              <div className="grid gap-3">
                {tools.map((tool) => {
                  const enabled = settings.get(tool.key) ?? tool.defaultEnabled;
                  return (
                    <Card key={tool.key} className="rounded-md">
                      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base">{tool.label}</CardTitle>
                            <Badge variant={tool.safety === "act" ? "outline" : "secondary"}>{tool.safety === "act" ? "Action" : "Read only"}</Badge>
                          </div>
                          <CardDescription>{tool.description}</CardDescription>
                        </div>
                        <Switch checked={masterEnabled && enabled} disabled={!isOrgAdmin || !masterEnabled || updateSetting.isPending} onCheckedChange={(value) => setTool(tool.key, value, tool.safety)} aria-label={`${enabled ? "Disable" : "Enable"} ${tool.label}`} />
                      </CardHeader>
                      <CardContent className="flex items-center gap-2 pt-0 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />{tool.confirmation}</CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
  );
};

const AiToolsSettingsPage = () => (
  <div className="min-h-full bg-background">
    <Header title="FlowLeed AI Tools" />
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <AiToolsSettingsContent />
    </main>
  </div>
);

export default AiToolsSettingsPage;