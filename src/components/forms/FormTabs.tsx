import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FormTabsProps {
  formId: string;
  active: "form" | "submissions" | "settings";
  count?: number | null;
  onSettings?: () => void;
}

/** Shared Form / Submissions / Settings tab bar for a single form. */
export function FormTabs({ formId, active, count, onSettings }: FormTabsProps) {
  const base = "px-3 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap";
  const cls = (k: string) =>
    cn(base, active === k ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground");
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      <Link to={`/forms/${formId}`} className={cls("form")}>Form</Link>
      <Link to={`/forms/${formId}/submissions`} className={cls("submissions")}>
        Submissions{typeof count === "number" ? ` (${count})` : ""}
      </Link>
      {onSettings ? (
        <button type="button" onClick={onSettings} className={cls("settings")}>Settings</button>
      ) : (
        <Link to={`/forms/${formId}?tab=settings`} className={cls("settings")}>Settings</Link>
      )}
    </nav>
  );
}
