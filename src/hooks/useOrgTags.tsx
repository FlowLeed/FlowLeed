import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgTag {
  tag: string;
  count: number;
}

/**
 * Single source of truth for the tags used in an organization.
 * Backed by the get_org_tag_stats database function, so there is no
 * row cap and every surface (settings, filters, bulk actions) agrees.
 */
export const useOrgTags = (organizationId?: string) => {
  const query = useQuery({
    queryKey: ["org-tags", organizationId],
    queryFn: async (): Promise<OrgTag[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase.rpc("get_org_tag_stats", {
        p_org_id: organizationId,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ tag: r.tag, count: Number(r.contact_count) }));
    },
    enabled: !!organizationId,
  });

  return {
    tagStats: query.data ?? [],
    tags: (query.data ?? []).map((t) => t.tag),
    isLoading: query.isLoading,
  };
};

/** Query keys to invalidate whenever tags change anywhere in the app. */
export const invalidateTagKeys = (queryClient: {
  invalidateQueries: (args: { queryKey: unknown[] }) => void;
}) => {
  queryClient.invalidateQueries({ queryKey: ["org-tags"] });
  queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
  queryClient.invalidateQueries({ queryKey: ["contact-comprehensive"] });
  queryClient.invalidateQueries({ queryKey: ["contacts"] });
};
