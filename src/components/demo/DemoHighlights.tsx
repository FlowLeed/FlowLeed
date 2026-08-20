import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useDemoMode } from "@/hooks/useDemoMode";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronRight } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  assign_follow_up: "Follow up",
  create_task: "Create task",
  send_message: "Send a message",
  add_to_flow: "Add to a flow",
};

/**
 * While sample data exists, surface the seeded AI recommendations so a new user
 * immediately sees "here are people who may need attention today".
 */
export const DemoHighlights = () => {
  const navigate = useNavigate();
  const { organization } = useProfile();
  const { isDemoMode } = useDemoMode();

  const { data: suggestions } = useQuery({
    queryKey: ["demo-highlights", organization?.id],
    enabled: !!organization?.id && isDemoMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_agent_suggestions")
        .select("id, contact_id, action_type, reasoning, contacts(name)")
        .eq("organization_id", organization!.id)
        .eq("status", "pending")
        .order("confidence", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isDemoMode || !suggestions?.length) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">
          Here are {suggestions.length} people who may need attention today
        </h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((s: any) => (
          <button
            key={s.id}
            onClick={() => navigate(`/contacts/${s.contact_id}`)}
            className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{s.contacts?.name ?? "Someone"}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {ACTION_LABEL[s.action_type] ?? s.action_type}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.reasoning}</p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        These are sample recommendations. Once your own people are in, FlowLeed generates these from real
        activity.
      </p>
    </Card>
  );
};
