import { Info, CheckCircle2, XCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type AiTrace = {
  total_ms: number;
  steps: { label: string; detail?: string; ms: number; status: "ok" | "error" }[];
};

const fmt = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

export function parseTrace(content: string): AiTrace | null {
  const m = content.match(/<!--flowleed:trace=([\s\S]*?)-->/);
  if (!m) return null;
  try {
    const t = JSON.parse(m[1]) as AiTrace;
    return Array.isArray(t?.steps) ? t : null;
  } catch {
    return null;
  }
}

/** "(i)" button showing a short, plain-language log of what FlowLeed AI did for this answer. */
export function AiTracePopover({ trace }: { trace: AiTrace }) {
  const tools = trace.steps.filter((s) => !/^(Read your question|Reviewed what it found|Wrote the answer)$/.test(s.label)).length;
  const errors = trace.steps.filter((s) => s.status === "error").length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="What FlowLeed AI did"
          className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <p className="text-xs font-semibold text-foreground">What FlowLeed AI did</p>
        <p className="mb-3 text-xs text-muted-foreground">
          {fmt(trace.total_ms)} · {tools} {tools === 1 ? "lookup" : "lookups"}
          {errors > 0 && <span className="text-destructive"> · {errors} {errors === 1 ? "error" : "errors"}</span>}
        </p>
        <ol className="relative space-y-3 border-l border-border pl-4">
          {trace.steps.map((s, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[22px] top-0.5 bg-popover">
                {s.status === "error"
                  ? <XCircle className="h-3.5 w-3.5 text-destructive" />
                  : <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{s.label}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(s.ms)}</span>
              </div>
              {s.detail && <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{s.detail}</p>}
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}
