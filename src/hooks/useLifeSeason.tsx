import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import type { LifeSeason, LifeSeasonReason } from '@/lib/lifeSeasons';
import { toast } from 'sonner';

/** The active (open-ended) life season for one person, if any. */
export function useLifeSeason(contactId: string | undefined) {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['life-season', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_life_seasons')
        .select('*')
        .eq('contact_id', contactId!)
        .is('ended_on', null)
        .maybeSingle();
      if (error) throw error;
      return (data as LifeSeason) ?? null;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['life-season', contactId] });
    queryClient.invalidateQueries({ queryKey: ['life-seasons', orgId] });
    queryClient.invalidateQueries({ queryKey: ['contact-comprehensive', contactId] });
  };

  const start = useMutation({
    mutationFn: async ({ reason, note }: { reason: LifeSeasonReason; note?: string }) => {
      if (!contactId || !orgId) throw new Error('Missing contact or organization');
      const { data: userData } = await supabase.auth.getUser();

      // Freeze whatever the score is right now.
      const { data: score } = await supabase
        .from('contact_engagement_scores')
        .select('score, engagement_level, score_breakdown')
        .eq('contact_id', contactId)
        .maybeSingle();

      const { error } = await supabase.from('contact_life_seasons').insert({
        organization_id: orgId,
        contact_id: contactId,
        reason,
        note: note?.trim() || null,
        frozen_score: score?.score ?? null,
        frozen_level: score?.engagement_level ?? null,
        frozen_breakdown: (score?.score_breakdown as never) ?? null,
        created_by_user_id: userData.user?.id ?? null,
        last_reminded_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Engagement paused for this person');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: async ({ reason, note }: { reason: LifeSeasonReason; note?: string }) => {
      const id = query.data?.id;
      if (!id) throw new Error('No active season');
      const { error } = await supabase
        .from('contact_life_seasons')
        .update({ reason, note: note?.trim() || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Season updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const end = useMutation({
    mutationFn: async (endReason?: string) => {
      const id = query.data?.id;
      if (!id) throw new Error('No active season');
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('contact_life_seasons')
        .update({
          ended_on: new Date().toISOString().slice(0, 10),
          ended_by_user_id: userData.user?.id ?? null,
          end_reason: endReason ?? 'manual',
        })
        .eq('id', id);
      if (error) throw error;
      if (orgId) {
        await supabase.rpc('calculate_engagement_scores', { p_org_id: orgId });
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success('Season ended — scoring resumes');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stillPaused = useMutation({
    mutationFn: async () => {
      const id = query.data?.id;
      if (!id) throw new Error('No active season');
      const { error } = await supabase
        .from('contact_life_seasons')
        .update({ last_reminded_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Thanks — we'll check back in 30 days");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { season: query.data ?? null, isLoading: query.isLoading, start, update, end, stillPaused };
}

/** Every person in the church currently in a life season. */
export function useActiveLifeSeasons() {
  const { organization } = useProfile();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ['life-seasons', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_life_seasons')
        .select('id, contact_id, reason, note, started_on')
        .eq('organization_id', orgId!)
        .is('ended_on', null);
      if (error) throw error;
      return (data ?? []) as Pick<LifeSeason, 'id' | 'contact_id' | 'reason' | 'note' | 'started_on'>[];
    },
  });
}

/** Set of paused contact ids, for hiding people from attention lists. */
export function usePausedContactIds() {
  const { data } = useActiveLifeSeasons();
  return useMemo(() => new Set((data ?? []).map((s) => s.contact_id)), [data]);
}
