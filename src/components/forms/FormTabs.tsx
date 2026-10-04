import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FormTabsProps {
  formId: string;
  active: "form" | "submissions" | "settings";
  count?: number | null;
  onSettings?: () => void;
}

/** Shared Form / Submissions / Settings tab bar for a single form. */
export function FormTabs({ formId, active, count, onSettings }: FormTabsProps) {
  const { data: liveCount } = useQuery({
    queryKey: ["form-submission-count", formId],
    enabled: typeof count !== "number",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("id")
        .eq("form_id", formId)
        .eq("is_preview", false)
        .limit(1000);
      if (error) throw error;
      return data?.length ?? 0;
    },
  });
  const shown = typeof count === "number" ? count : liveCount;
  const base = "px-3 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap";
  const cls = (k: string) =>
    cn(base, active === k ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground");
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      <Link to={`/forms/${formId}`} className={cls("form")}>Form</Link>
      <Link to={`/forms/${formId}/submissions`} className={cls("submissions")}>
        Submissions{typeof shown === "number" ? ` (${shown})` : ""}
      </Link>
      {onSettings ? (
        <button type="button" onClick={onSettings} className={cls("settings")}>Settings</button>
      ) : (
        <Link to={`/forms/${formId}?tab=settings`} className={cls("settings")}>Settings</Link>
      )}
    </nav>
  );
}
