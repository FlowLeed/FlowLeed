import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity } from "lucide-react";
import { useContactSignal } from "@/hooks/useContactSignal";
import { SignalChip } from "./SignalChip";

const polarityClass: Record<string, string> = {
  positive: "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
  neutral: "bg-muted text-muted-foreground border-border",
  negative: "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
};

interface Props {
  contactId: string | undefined;
}

export function ActiveMarkersCard({ contactId }: Props) {
  const { data, isLoading } = useContactSignal(contactId);

  if (isLoading) return null;

  const markers = data?.markers || [];
  const positives = markers.filter((m) => m.polarity === "positive");
  const negatives = markers.filter((m) => m.polarity === "negative");
  const neutrals = markers.filter((m) => m.polarity === "neutral");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active markers
          </CardTitle>
          <SignalChip signal={data?.signal ?? null} markers={markers} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {markers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active markers yet. Markers appear as new check-ins, group attendance, serving, and other signals come in.
          </p>
        ) : (
          <>
            <Section title="Strengths" items={positives} />
            <Section title="Watch" items={negatives} />
            {neutrals.length > 0 && <Section title="Other" items={neutrals} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: any[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <TooltipProvider>
        <div className="flex flex-wrap gap-1.5">
          {items.map((m) => (
            <Tooltip key={m.key}>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`${polarityClass[m.polarity]} text-xs cursor-default`}>
                  {m.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                {m.value_text && <p className="text-xs mt-1">{m.value_text}</p>}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
