import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRef } from 'react';

export interface EngagementScore {
  contact_id: string;
  organization_id: string;
  total_checkins_90d: number;
  total_checkins_30d: number;
  weeks_attended_last_12: number;
  last_checkin_at: string | null;
  engagement_level: 'highly_engaged' | 'active' | 'at_risk' | 'inactive' | 'new';
  streak_weeks: number;
  volunteer_checkins_90d: number;
  score: number;
  updated_at: string;
}

export interface CheckinRecord {
  id: string;
  contact_id: string | null;
  pc_person_id: string;
  event_name: string | null;
  event_time_name: string | null;
  location_name: string | null;
  checkin_kind: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  pco_checkin_id: string;
  metadata: any;
  created_at: string;
}

export function useEngagementScore(contactId: string | undefined) {
  return useQuery({
    queryKey: ['engagement-score', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from('contact_engagement_scores')
        .select('*')
        .eq('contact_id', contactId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EngagementScore | null;
    },
    enabled: !!contactId,
  });
}

export function useContactCheckins(contactId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['contact-checkins', contactId, limit],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from('pco_checkins')
        .select('*')
        .eq('contact_id', contactId)
        .order('checked_in_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as CheckinRecord[];
    },
    enabled: !!contactId,
  });
}

export function useSyncCheckins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const toastIdRef = useRef<string | undefined>();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      let totalSynced = 0;
      let totalMatched = 0;
      let round = 0;
      const maxRounds = 15;
      let hasMore = true;

      while (hasMore && round < maxRounds) {
        round++;

        // Show progress toast on subsequent rounds
        if (round > 1) {
          toast({
            title: 'Syncing check-ins...',
            description: `Processing batch ${round} (${totalSynced} synced so far)`,
          });
        }

        const { data, error } = await supabase.functions.invoke('pco-sync-checkins', {
          body: { integrationId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        totalSynced += data.synced || 0;
        totalMatched = data.matched || totalMatched;
        hasMore = data.hasMore === true;
      }

      return { synced: totalSynced, matched: totalMatched, rounds: round };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contact-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-score'] });
      queryClient.invalidateQueries({ queryKey: ['org-checkin-stats'] });
      toast({
        title: 'Check-ins synced',
        description: `Synced ${data.synced} check-ins, matched ${data.matched} contacts${data.rounds > 1 ? ` (${data.rounds} batches)` : ''}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Check-in sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useOrgCheckinStats(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-checkin-stats', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [weekRes, monthRes, levelRes] = await Promise.all([
        supabase
          .from('pco_checkins')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('checked_in_at', weekAgo),
        supabase
          .from('pco_checkins')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('checked_in_at', monthAgo),
        supabase
          .from('contact_engagement_scores')
          .select('engagement_level')
          .eq('organization_id', orgId),
      ]);

      const levels = (levelRes.data || []) as unknown as { engagement_level: string }[];
      const distribution: Record<string, number> = {};
      for (const row of levels) {
        distribution[row.engagement_level] = (distribution[row.engagement_level] || 0) + 1;
      }

      return {
        checkinsThisWeek: weekRes.count || 0,
        checkinsThisMonth: monthRes.count || 0,
        engagementDistribution: distribution,
      };
    },
    enabled: !!orgId,
  });
}
