import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Heart, TrendingDown, AlertTriangle, Activity, Sparkles, HelpCircle } from "lucide-react";
import type { SignalLevel, Marker } from "@/hooks/useContactSignal";

interface SignalChipProps {
  signal: SignalLevel | null;
  markers?: Marker[];
  compact?: boolean;
}

const config: Record<SignalLevel, { label: string; icon: any; className: string }> = {
  thriving: {
    label: "Thriving",
    icon: Sparkles,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  steady: {
    label: "Steady",
    icon: Heart,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  slowing: {
    label: "Slowing",
    icon: TrendingDown,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  drifting: {
    label: "Drifting",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  new: {
    label: "New",
    icon: Activity,
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function SignalChip({ signal, markers = [], compact = false }: SignalChipProps) {
  if (!signal) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
        <HelpCircle className="h-3 w-3" />
        {compact ? "—" : "Unscored"}
      </Badge>
    );
  }
  const c = config[signal];
  const Icon = c.icon;

  const top = markers.slice(0, 3);
  const tooltip = top.length
    ? top.map((m) => `${m.polarity === "negative" ? "⚠ " : m.polarity === "positive" ? "✓ " : "• "}${m.label}${m.value_text ? ` — ${m.value_text}` : ""}`).join("\n")
    : "No active markers yet.";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${c.className} gap-1 text-xs cursor-default`}>
            <Icon className="h-3 w-3" />
            {c.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const SIGNAL_RISK_ORDER: Record<SignalLevel, number> = {
  drifting: 0,
  slowing: 1,
  new: 2,
  steady: 3,
  thriving: 4,
};
