import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FlowSelectionStep } from './FlowSelectionStep';
import { StageSelectionStep } from './StageSelectionStep';
import { ArrowLeft } from 'lucide-react';

interface AddToFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  currentPipelineIds: string[];
}

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

export const AddToFlowDialog: React.FC<AddToFlowDialogProps> = ({
  open,
  onOpenChange,
  contactId,
  currentPipelineIds
}) => {
  const [step, setStep] = useState<'pipeline' | 'stage'>('pipeline');
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available pipelines (excluding current ones)
  const { data: availablePipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['available-pipelines', currentPipelineIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, description, icon')
        .order('name');

      if (error) throw error;
      
      console.log('All pipelines from DB:', data);
      console.log('Current pipeline IDs:', currentPipelineIds);
      
      // Filter out pipelines the contact is already in
      const filtered = currentPipelineIds.length > 0
        ? data?.filter(p => !currentPipelineIds.includes(p.id))
        : data;
      
      console.log('Filtered available pipelines:', filtered);
      
      return filtered as Pipeline[];
    },
    enabled: open
  });

  // Fetch stages for selected pipeline
  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ['pipeline-stages', selectedPipeline?.id],
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
    enabled: !!selectedPipeline
  });

  // Add contact to flow mutation
  const addToFlowMutation = useMutation({
    mutationFn: async ({ stageId, stageOrder, defaultAssigneeUserId }: { stageId: string; stageOrder: number; defaultAssigneeUserId?: string | null }) => {
      if (!selectedPipeline) throw new Error('No pipeline selected');

      const { error } = await supabase
        .from('pipeline_contacts')
        .insert({
          contact_id: contactId,
          pipeline_id: selectedPipeline.id,
          stage_id: stageId,
          stage_order: stageOrder,
          assigned_to_user_id: defaultAssigneeUserId || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate contact query to update contact profile
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      
      // Invalidate pipeline queries to update pipeline views
      queryClient.invalidateQueries({ queryKey: ['available-pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
      
      // Force reload of pipeline context data by invalidating all pipeline-related queries
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      
      // Refresh the current page to reload pipeline data
      window.location.reload();
      
      toast({
        title: "Success",
        description: `Contact added to ${selectedPipeline?.name} flow`
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add contact to flow",
        variant: "destructive"
      });
      console.error('Error adding contact to flow:', error);
    }
  });

  const handleClose = () => {
    setStep('pipeline');
    setSelectedPipeline(null);
    onOpenChange(false);
  };

  const handlePipelineSelect = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setStep('stage');
  };

  const handleStageSelect = (stage: Stage) => {
    addToFlowMutation.mutate({
      stageId: stage.id,
      stageOrder: stage.stage_order,
      defaultAssigneeUserId: stage.default_assignee_user_id
    });
  };

  const handleBack = () => {
    if (step === 'stage') {
      setStep('pipeline');
      setSelectedPipeline(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {step === 'stage' && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === 'pipeline' ? 'Select Flow' : `Select Stage in ${selectedPipeline?.name}`}
            </DialogTitle>
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
            adding={addToFlowMutation.isPending}
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