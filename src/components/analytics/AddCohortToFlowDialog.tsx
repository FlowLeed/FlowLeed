import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';
import { FlowSelectionStep } from '@/components/contact/FlowSelectionStep';
import { StageSelectionStep } from '@/components/contact/StageSelectionStep';
import { ArrowLeft, Users } from 'lucide-react';
import type { EngagementLevel } from '@/hooks/useEngagementTrends';

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
  stage_order: number;
  default_assignee_user_id?: string | null;
}

interface AddCohortToFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementLevel: EngagementLevel;
  cohortLabel: string;
  campusId?: string | null;
  estimatedCount?: number;
}

export const AddCohortToFlowDialog: React.FC<AddCohortToFlowDialogProps> = ({
  open,
  onOpenChange,
  engagementLevel,
  cohortLabel,
  campusId,
  estimatedCount,
}) => {
  const [step, setStep] = useState<'pipeline' | 'stage'>('pipeline');
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const { organization } = useProfile();
  const orgId = organization?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch contact IDs in this cohort
  const { data: cohortContactIds = [], isLoading: loadingCohort } = useQuery({
    queryKey: ['cohort-contact-ids', orgId, engagementLevel, campusId],
    enabled: open && !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('contact_engagement_scores')
        .select('contact_id, contacts!inner(id, organization_id, campus_id)')
        .eq('engagement_level', engagementLevel)
        .eq('contacts.organization_id', orgId!);
      if (campusId) q = q.eq('contacts.campus_id', campusId);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data || []).map((r: any) => r.contact_id as string);
    },
  });

  const { data: availablePipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['available-pipelines-bulk'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, description, icon')
        .order('name');
      if (error) throw error;
      return data as Pipeline[];
    },
  });

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ['pipeline-stages', selectedPipeline?.id],
    enabled: !!selectedPipeline,
    queryFn: async () => {
      if (!selectedPipeline) return [];
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, stage_order, default_assignee_user_id')
        .eq('pipeline_id', selectedPipeline.id)
        .order('stage_order');
      if (error) throw error;
      return data as Stage[];
    },
  });

  const addCohortMutation = useMutation({
    mutationFn: async ({ stageId, stageOrder, defaultAssigneeUserId }: { stageId: string; stageOrder: number; defaultAssigneeUserId?: string | null }) => {
      if (!selectedPipeline) throw new Error('No flow selected');
      if (cohortContactIds.length === 0) throw new Error('No contacts in cohort');

      // Skip contacts already in this flow
      const { data: existing } = await supabase
        .from('pipeline_contacts')
        .select('contact_id')
        .eq('pipeline_id', selectedPipeline.id)
        .in('contact_id', cohortContactIds);
      const existingSet = new Set((existing || []).map((r: any) => r.contact_id));
      const toInsert = cohortContactIds.filter((id) => !existingSet.has(id));

      if (toInsert.length === 0) {
        return { added: 0, skipped: cohortContactIds.length };
      }

      // Insert in chunks of 500
      const chunkSize = 500;
      let added = 0;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const rows = chunk.map((cid) => ({
          contact_id: cid,
          pipeline_id: selectedPipeline.id,
          stage_id: stageId,
          stage_order: stageOrder,
          assigned_to_user_id: defaultAssigneeUserId || null,
          source_type: 'manual' as const,
        }));
        const { error } = await supabase.from('pipeline_contacts').insert(rows);
        if (error) throw error;
        added += chunk.length;
      }
      return { added, skipped: cohortContactIds.length - added };
    },
    onSuccess: ({ added, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      window.dispatchEvent(new CustomEvent('flow-assignment-updated'));
      toast({
        title: 'Cohort added to flow',
        description:
          added > 0
            ? `Added ${added} ${added === 1 ? 'person' : 'people'} to ${selectedPipeline?.name}` +
              (skipped > 0 ? ` (${skipped} already in flow)` : '')
            : `Everyone in this cohort was already in ${selectedPipeline?.name}`,
      });
      handleClose();
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to add cohort',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setStep('pipeline');
    setSelectedPipeline(null);
    onOpenChange(false);
  };

  const handlePipelineSelect = (p: Pipeline) => {
    setSelectedPipeline(p);
    setStep('stage');
  };

  const handleStageSelect = (s: Stage) => {
    addCohortMutation.mutate({
      stageId: s.id,
      stageOrder: s.stage_order,
      defaultAssigneeUserId: s.default_assignee_user_id,
    });
  };

  const cohortSize = useMemo(
    () => (loadingCohort ? estimatedCount ?? 0 : cohortContactIds.length),
    [loadingCohort, cohortContactIds, estimatedCount]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {step === 'stage' && (
              <Button variant="ghost" size="sm" onClick={() => { setStep('pipeline'); setSelectedPipeline(null); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle>
                {step === 'pipeline'
                  ? `Start follow-up for ${cohortLabel}`
                  : `Pick a stage in ${selectedPipeline?.name}`}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 mt-1">
                <Users className="h-3.5 w-3.5" />
                {loadingCohort ? 'Loading cohort…' : `${cohortSize} ${cohortSize === 1 ? 'person' : 'people'} will be added`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'pipeline' && (
          <FlowSelectionStep
            pipelines={availablePipelines || []}
            loading={loadingPipelines}
            onSelect={handlePipelineSelect}
          />
        )}

        {step === 'stage' && selectedPipeline && (
          <StageSelectionStep
            stages={stages || []}
            loading={loadingStages}
            onSelect={handleStageSelect}
            adding={addCohortMutation.isPending}
          />
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
