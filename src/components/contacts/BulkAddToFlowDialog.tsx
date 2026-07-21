import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FlowSelectionStep } from '../contact/FlowSelectionStep';
import { StageSelectionStep } from '../contact/StageSelectionStep';
import { ArrowLeft } from 'lucide-react';

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

interface BulkAddToFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  onSuccess?: () => void;
}

export const BulkAddToFlowDialog: React.FC<BulkAddToFlowDialogProps> = ({
  open,
  onOpenChange,
  contactIds,
  onSuccess,
}) => {
  const [step, setStep] = useState<'pipeline' | 'stage'>('pipeline');
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const queryClient = useQueryClient();

  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['bulk-add-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, description, icon')
        .order('name');
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: open,
  });

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ['bulk-add-stages', selectedPipeline?.id],
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
    enabled: !!selectedPipeline,
  });

  const addMutation = useMutation({
    mutationFn: async (stage: Stage) => {
      if (!selectedPipeline) throw new Error('No flow selected');

      // Skip contacts already in this flow
      const { data: existing, error: existErr } = await supabase
        .from('pipeline_contacts')
        .select('contact_id')
        .eq('pipeline_id', selectedPipeline.id)
        .in('contact_id', contactIds);
      if (existErr) throw existErr;

      const existingSet = new Set((existing ?? []).map(r => r.contact_id));
      const toInsert = contactIds.filter(id => !existingSet.has(id));
      const skipped = contactIds.length - toInsert.length;

      if (toInsert.length === 0) {
        return { added: 0, skipped };
      }

      const inserts = toInsert.map((contactId, index) => ({
        contact_id: contactId,
        pipeline_id: selectedPipeline.id,
        stage_id: stage.id,
        stage_order: stage.stage_order + index,
        assigned_to_user_id: stage.default_assignee_user_id || null,
        source_type: 'manual',
      }));

      const { error } = await supabase.from('pipeline_contacts').insert(inserts);
      if (error) throw error;
      return { added: toInsert.length, skipped };
    },
    onSuccess: ({ added, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      // FlowContext refreshes on window events, not query invalidations
      window.dispatchEvent(new CustomEvent('flow-assignment-updated'));
      if (added > 0) {
        toast.success(
          `Added ${added} ${added === 1 ? 'person' : 'people'} to ${selectedPipeline?.name}${
            skipped > 0 ? ` (${skipped} already in flow)` : ''
          }`
        );
      } else {
        toast.info(`All selected people are already in ${selectedPipeline?.name}`);
      }
      handleClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error(error);
      toast.error('Failed to add people to flow');
    },
  });

  const handleClose = () => {
    setStep('pipeline');
    setSelectedPipeline(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {step === 'stage' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('pipeline');
                  setSelectedPipeline(null);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === 'pipeline'
                ? `Add ${contactIds.length} ${contactIds.length === 1 ? 'person' : 'people'} to Flow`
                : `Select Step in ${selectedPipeline?.name}`}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === 'pipeline' && (
          <FlowSelectionStep
            pipelines={pipelines || []}
            loading={loadingPipelines}
            onSelect={(p) => {
              setSelectedPipeline(p);
              setStep('stage');
            }}
          />
        )}

        {step === 'stage' && selectedPipeline && (
          <StageSelectionStep
            stages={stages || []}
            loading={loadingStages}
            adding={addMutation.isPending}
            onSelect={(s) => addMutation.mutate(s)}
          />
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
