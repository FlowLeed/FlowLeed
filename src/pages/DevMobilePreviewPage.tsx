import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

/**
 * Dev-only preview page that renders the meeting attendance block and meeting
 * cards inside fixed mobile-width frames to validate that nothing overflows
 * or wraps badly at 320 / 360 / 375 / 414 px.
 *
 * Visit /dev/mobile-preview to use.
 */

const VIEWPORTS = [320, 360, 375, 414];

const SAMPLE_MEETINGS = [
  {
    id: "1",
    title: "Built for Purpose | Young Men 18-35 | Ricky & Corey",
    meeting_date: new Date("2026-06-26").toISOString(),
    duration_minutes: 60,
    location: "physical",
    status: "scheduled" as const,
    attendance_submitted: false,
    description: "<div>Our group meets Friday at 6:30pm!</div>",
    att: undefined as { present: number; total: number } | undefined,
  },
  {
    id: "2",
    title: "Sunday Service Volunteers",
    meeting_date: new Date("2026-05-22").toISOString(),
    duration_minutes: 90,
    location: "Main Auditorium",
    status: "completed" as const,
    attendance_submitted: true,
    description: "Weekly volunteer huddle before service.",
    att: { present: 5, total: 32 },
  },
];

const SAMPLE_TREND = [22, 28, 24, 0, 30, 26, 27].map((p, i) => ({
  id: `t${i}`,
  meeting_date: new Date(2026, 4, 1 + i).toISOString(),
  present: p,
  total: 32,
}));

function MeetingCard({ meeting }: { meeting: (typeof SAMPLE_MEETINGS)[number] }) {
  const att = meeting.att;
  const pct = att && att.total ? Math.round((att.present / att.total) * 100) : null;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg break-words">{meeting.title}</CardTitle>
            <CardDescription className="break-words">
              {new Date(meeting.meeting_date).toLocaleDateString()} • {meeting.duration_minutes} min •{" "}
              {meeting.location}
            </CardDescription>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {att && att.total > 0 ? (
                <Badge variant="secondary">
                  {att.present} / {att.total} present{pct !== null ? ` (${pct}%)` : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Not recorded
                </Badge>
              )}
              {meeting.attendance_submitted && (
                <Badge
                  variant="secondary"
                  className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                >
                  Submitted
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Badge variant={meeting.status === "completed" ? "secondary" : "default"}>
              {meeting.status}
            </Badge>
            <Button size="sm" variant="outline">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Take Attendance
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground break-words">
          {meeting.description.replace(/<[^>]*>/g, "").trim()}
        </p>
      </CardContent>
    </Card>
  );
}

function AttendanceBlock() {
  const completed = SAMPLE_TREND.filter((x) => x.total > 0);
  const avgPresent = Math.round(completed.reduce((s, x) => s + x.present, 0) / completed.length);
  const avgTotal = Math.round(completed.reduce((s, x) => s + x.total, 0) / completed.length);
  const avgPct = avgTotal ? Math.round((avgPresent / avgTotal) * 100) : 0;
  const last = completed[completed.length - 1];
  const lastPct = last.total ? Math.round((last.present / last.total) * 100) : 0;
  return (
    <Card>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg attendance</p>
          <p className="text-2xl font-bold">
            {avgPresent} / {avgTotal}
            <span className="text-sm font-normal text-muted-foreground ml-2">({avgPct}%)</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">last {completed.length} meetings</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last meeting</p>
          <p className="text-2xl font-bold">
            {last.present} / {last.total}
            <span className="text-sm font-normal text-muted-foreground ml-2">({lastPct}%)</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(last.meeting_date).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Trend</p>
          <div className="flex items-end gap-1 h-12">
            {completed.map((x) => {
              const pct = x.total ? (x.present / x.total) * 100 : 0;
              return (
                <div
                  key={x.id}
                  className="flex-1 bg-primary/70 rounded-sm min-h-[2px]"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverflowFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<{ x: boolean; offenders: string[] }>({
    x: false,
    offenders: [],
  });

  useEffect(() => {
    const check = () => {
      const root = innerRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const offenders: string[] = [];
      root.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right - rootRect.left > rootRect.width + 0.5) {
          const label =
            el.tagName.toLowerCase() +
            (el.className && typeof el.className === "string"
              ? "." + el.className.split(" ").slice(0, 2).join(".")
              : "");
          if (offenders.length < 5) offenders.push(label);
        }
      });
      setOverflow({
        x: root.scrollWidth > root.clientWidth + 0.5,
        offenders,
      });
    };
    check();
    const id = window.setTimeout(check, 250);
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", check);
    };
  }, [width]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">{width}px</span>
        {overflow.x ? (
          <span className="text-destructive font-medium">⚠ horizontal overflow</span>
        ) : (
          <span className="text-green-600 dark:text-green-400">✓ no overflow</span>
        )}
      </div>
      <div
        className="border rounded-md bg-background overflow-hidden"
        style={{ width: `${width}px` }}
      >
        <div ref={innerRef} className="overflow-x-auto p-4 space-y-4" style={{ width: `${width}px` }}>
          {children}
        </div>
      </div>
      {overflow.offenders.length > 0 && (
        <div className="text-[10px] font-mono text-destructive/80 break-all">
          {overflow.offenders.join(" • ")}
        </div>
      )}
    </div>
  );
}

export default function DevMobilePreviewPage() {
  return (
    <div className="min-h-screen overflow-y-auto p-6 bg-muted/30">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mobile breakpoint preview</h1>
          <p className="text-sm text-muted-foreground">
            Renders the meeting attendance block and meeting cards inside fixed-width
            iframes-of-sorts to validate against overflow and bad wrapping at common
            mobile widths.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Attendance summary block</h2>
          <div className="flex flex-wrap gap-6">
            {VIEWPORTS.map((w) => (
              <OverflowFrame key={w} width={w}>
                <AttendanceBlock />
              </OverflowFrame>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Meeting cards</h2>
          <div className="flex flex-wrap gap-6">
            {VIEWPORTS.map((w) => (
              <OverflowFrame key={w} width={w}>
                {SAMPLE_MEETINGS.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </OverflowFrame>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
