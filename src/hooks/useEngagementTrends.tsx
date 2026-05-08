import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EngagementLevel = "highly_engaged" | "active" | "at_risk" | "inactive" | "new";

export interface EngagementTrendPoint {
  date: string; // YYYY-MM-DD
  counts: Record<EngagementLevel, number>;
}

export interface EngagementTrends {
  // counts from a snapshot ~30 days ago, keyed by level
  baseline: Partial<Record<EngagementLevel, number>>;
  baselineDate: string | null;
  // daily series for sparklines
  series: EngagementTrendPoint[];
}

const LEVELS: EngagementLevel[] = ["highly_engaged", "active", "at_risk", "inactive", "new"];

export function useEngagementTrends(orgId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ["engagement-trends", orgId, days],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EngagementTrends> => {
      if (!orgId) return { baseline: {}, baselineDate: null, series: [] };

      const asOf = new Date();
      asOf.setDate(asOf.getDate() - days);
      const asOfStr = asOf.toISOString().slice(0, 10);

      const [baseRes, seriesRes] = await Promise.all([
        supabase.rpc("get_engagement_snapshot" as any, {
          p_org_id: orgId,
          p_as_of: asOfStr,
        }),
        supabase.rpc("get_engagement_snapshot_series" as any, {
          p_org_id: orgId,
          p_days: days,
        }),
      ]);

      const baseline: Partial<Record<EngagementLevel, number>> = {};
      let baselineDate: string | null = null;
      const baseRows = (baseRes.data as any[]) || [];
      for (const r of baseRows) {
        baseline[r.engagement_level as EngagementLevel] = Number(r.count) || 0;
        baselineDate = r.snapshot_date;
      }

      const seriesByDate = new Map<string, Record<EngagementLevel, number>>();
      const seriesRows = (seriesRes.data as any[]) || [];
      for (const r of seriesRows) {
        const d = r.snapshot_date as string;
        if (!seriesByDate.has(d)) {
          seriesByDate.set(d, {
            highly_engaged: 0,
            active: 0,
            at_risk: 0,
            inactive: 0,
            new: 0,
          });
        }
        seriesByDate.get(d)![r.engagement_level as EngagementLevel] = Number(r.count) || 0;
      }
      const series: EngagementTrendPoint[] = Array.from(seriesByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, counts }));

      // ensure all known levels present in baseline (default 0)
      for (const l of LEVELS) if (baseline[l] === undefined) baseline[l] = 0;

      return { baseline, baselineDate, series };
    },
  });
}
