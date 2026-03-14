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
  checked_in_by?: string | null; // name of household member if from household
  is_household?: boolean;
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

/** Fetches check-ins for the contact and their household members */
export function useContactCheckins(contactId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['contact-checkins', contactId, limit],
    queryFn: async () => {
      if (!contactId) return { checkins: [] as CheckinRecord[], hasHousehold: false };

      // 1. Fetch own check-ins
      const { data: ownCheckins, error: ownErr } = await supabase
        .from('pco_checkins')
        .select('*')
        .eq('contact_id', contactId)
        .order('checked_in_at', { ascending: false })
        .limit(limit);
      if (ownErr) throw ownErr;

      const own = ((ownCheckins || []) as unknown as CheckinRecord[]).map(c => ({
        ...c,
        checked_in_by: null,
        is_household: false,
      }));

      // 2. Look up household ID and family members in parallel
      const [contactRes, familyRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('pc_household_id, name')
          .eq('id', contactId)
          .maybeSingle(),
        supabase
          .from('contact_family_members')
          .select('name, pc_person_id, relationship')
          .eq('contact_id', contactId)
          .not('pc_person_id', 'is', null),
      ]);

      const householdId = contactRes.data?.pc_household_id;
      const familyMembers = familyRes.data || [];

      // 3. Find household members from contacts table
      let householdContacts: { id: string; name: string }[] = [];
      if (householdId) {
        const { data } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('pc_household_id', householdId)
          .neq('id', contactId);
        householdContacts = data || [];
      }

      // 4. Fetch household check-ins from contacts table (by contact_id)
      let householdByContact: (CheckinRecord & { checked_in_by: string; is_household: true })[] = [];
      if (householdContacts.length > 0) {
        const householdIds = householdContacts.map(c => c.id);
        const nameMap = Object.fromEntries(householdContacts.map(c => [c.id, c.name]));

        const { data: hhCheckins, error: hhErr } = await supabase
          .from('pco_checkins')
          .select('*')
          .in('contact_id', householdIds)
          .order('checked_in_at', { ascending: false })
          .limit(limit * 2);
        if (hhErr) throw hhErr;

        householdByContact = ((hhCheckins || []) as unknown as CheckinRecord[]).map(c => ({
          ...c,
          checked_in_by: nameMap[c.contact_id || ''] || 'Household member',
          is_household: true as const,
        }));
      }

      // 5. Fetch family member check-ins by pc_person_id (for kids/spouse not in contacts table)
      const existingHouseholdPersonIds = new Set(householdContacts.map(c => c.id));
      const familyWithCheckins = familyMembers.filter(fm => fm.pc_person_id);
      let familyCheckins: (CheckinRecord & { checked_in_by: string; is_household: true })[] = [];

      if (familyWithCheckins.length > 0) {
        const familyPersonIds = familyWithCheckins.map(fm => fm.pc_person_id!);
        const familyNameMap = Object.fromEntries(
          familyWithCheckins.map(fm => [fm.pc_person_id!, fm.name])
        );

        // Exclude pc_person_ids already covered by household contacts
        const alreadyCoveredPersonIds = new Set<string>();
        for (const hc of householdContacts) {
          // Look up pc_person_id for household contacts we already fetched
          const { data: hcContact } = await supabase
            .from('contacts')
            .select('pc_person_id')
            .eq('id', hc.id)
            .maybeSingle();
          if (hcContact?.pc_person_id) {
            alreadyCoveredPersonIds.add(hcContact.pc_person_id);
          }
        }

        const uncoveredPersonIds = familyPersonIds.filter(pid => !alreadyCoveredPersonIds.has(pid));

        if (uncoveredPersonIds.length > 0) {
          const { data: fmCheckins, error: fmErr } = await supabase
            .from('pco_checkins')
            .select('*')
            .in('pc_person_id', uncoveredPersonIds)
            .order('checked_in_at', { ascending: false })
            .limit(limit * 2);
          if (fmErr) throw fmErr;

          familyCheckins = ((fmCheckins || []) as unknown as CheckinRecord[]).map(c => ({
            ...c,
            checked_in_by: familyNameMap[c.pc_person_id] || 'Family member',
            is_household: true as const,
          }));
        }
      }

      // 6. Merge all household check-ins
      const allHousehold = [...householdByContact, ...familyCheckins];
      const hasHousehold = allHousehold.length > 0;

      if (!hasHousehold) {
        return { checkins: own.slice(0, limit), hasHousehold: false };
      }

      // 7. Deduplicate (prefer own check-in over household for same event+date)
      const ownKeys = new Set(
        own.map(c => {
          const date = c.checked_in_at ? c.checked_in_at.substring(0, 10) : '';
          return `${c.event_name}|${date}`;
        })
      );

      const uniqueHousehold = allHousehold.filter(c => {
        const date = c.checked_in_at ? c.checked_in_at.substring(0, 10) : '';
        const key = `${c.event_name}|${date}`;
        return !ownKeys.has(key);
      });

      const merged = [...own, ...uniqueHousehold]
        .sort((a, b) => {
          const da = a.checked_in_at || '';
          const db = b.checked_in_at || '';
          return db.localeCompare(da);
        })
        .slice(0, limit);

      return { checkins: merged, hasHousehold: true };
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
