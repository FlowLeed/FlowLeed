import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SignalLevel = "thriving" | "steady" | "slowing" | "drifting" | "new";

export interface Marker {
  key: string;
  label: string;
  description: string;
  category: string;
  polarity: "positive" | "neutral" | "negative";
  value_text: string | null;
  value_numeric: number | null;
  sort_order: number;
}

export interface ContactSignal {
  signal: SignalLevel | null;
  engagement_level: string | null;
  score: number | null;
  markers: Marker[];
}

export function useContactSignal(contactId: string | undefined) {
  return useQuery({
    queryKey: ["contact-signal", contactId],
    enabled: !!contactId,
    staleTime: 60_000,
    queryFn: async (): Promise<ContactSignal> => {
      if (!contactId) return { signal: null, engagement_level: null, score: null, markers: [] };
      const { data, error } = await supabase.rpc("get_contact_signal" as any, {
        p_contact_id: contactId,
      });
      if (error) throw error;
      const rows = (data as any[]) || [];
      const first = rows[0];
      const markers: Marker[] = rows
        .filter((r) => r.marker_key)
        .map((r) => ({
          key: r.marker_key,
          label: r.label,
          description: r.description,
          category: r.category,
          polarity: r.polarity,
          value_text: r.value_text,
          value_numeric: r.value_numeric,
          sort_order: r.sort_order,
        }));
      return {
        signal: (first?.signal as SignalLevel) ?? null,
        engagement_level: first?.engagement_level ?? null,
        score: first?.score ?? null,
        markers,
      };
    },
  });
}
