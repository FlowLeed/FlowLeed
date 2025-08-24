import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { PlanningCenterListBrowser } from './PlanningCenterListBrowser';
import { FlowSelectionStep } from '../contact/FlowSelectionStep';
import { StageSelectionStep } from '../contact/StageSelectionStep';

interface ListToStageMappingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
}

interface PlanningCenterList {
  id: string;
  attributes: {
    name: string;
    description?: string;
    total_people?: number;
    list_type?: string;
    updated_at?: string;
  };
}

interface Pipeline {
  id: string;
  name: string;
  icon?: string;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
}

export function ListToStageMappingDialog({
  isOpen,
  onOpenChange,
  integrationId,
}: ListToStageMappingDialogProps) {
  const [step, setStep] = useState<'list' | 'pipeline' | 'stage'>('list');
  const [selectedList, setSelectedList] = useState<PlanningCenterList | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, icon')
        .order('name');
      
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: step === 'pipeline',
  });

  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages', selectedPipeline?.id],
    queryFn: async () => {
      if (!selectedPipeline) return [];
      
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, color')
        .eq('pipeline_id', selectedPipeline.id)
        .order('stage_order');
      
      if (error) throw error;
      return data as Stage[];
    },
    enabled: step === 'stage' && !!selectedPipeline,
  });

  const createMappingMutation = useMutation({
    mutationFn: async ({ stageId }: { stageId: string }) => {
      if (!selectedList || !selectedPipeline) {
        throw new Error('Missing required data');
      }

      const { error } = await supabase
        .from('integration_list_mappings')
        .insert({
          integration_id: integrationId,
          pipeline_id: selectedPipeline.id,
          stage_id: stageId,
          external_list_id: selectedList.id,
          external_list_name: selectedList.attributes.name,
        });

      if (error) throw error;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['integration-list-mappings'] });
      toast({
        title: 'Mapping created',
        description: `Successfully mapped "${selectedList?.attributes.name}" to the selected pipeline stage. Starting sync...`,
      });
      
      // Automatically trigger sync for the new mapping
      try {
        const newMapping = {
          id: 'temp', // This will be ignored in sync
          integration_id: integrationId,
          pipeline_id: selectedPipeline?.id,
          stage_id: variables.stageId,
          external_list_id: selectedList?.id,
          external_list_name: selectedList?.attributes.name,
        };
        
        const { data: syncData, error: syncError } = await supabase.functions.invoke('planning-center-lists', {
          body: {
            action: 'syncLists',
            listMappings: [newMapping],
          },
        });

        if (syncError) throw syncError;

        const result = syncData.results[0];
        if (result.success) {
          toast({
            title: 'Sync completed',
            description: `Added ${result.contactsAdded} new contacts, updated ${result.contactsUpdated} existing contacts.`,
          });
        } else {
          toast({
            title: 'Sync failed',
            description: result.error || 'Unknown sync error',
            variant: 'destructive',
          });
        }
      } catch (syncError) {
        console.error('Auto-sync error:', syncError);
        toast({
          title: 'Mapping created, sync failed',
          description: 'The mapping was created but automatic sync failed. Try manual sync.',
          variant: 'destructive',
        });
      }
      
      handleClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create mapping. Please try again.',
        variant: 'destructive',
      });
      console.error('Error creating mapping:', error);
    },
  });

  const handleClose = () => {
    setStep('list');
    setSelectedList(null);
    setSelectedPipeline(null);
    onOpenChange(false);
  };

  const handleListSelect = (list: PlanningCenterList) => {
    setSelectedList(list);
    setStep('pipeline');
  };

  const handlePipelineSelect = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setStep('stage');
  };

  const handleStageSelect = (stageId: string) => {
    createMappingMutation.mutate({ stageId });
  };

  const handleBack = () => {
    if (step === 'pipeline') {
      setStep('list');
      setSelectedList(null);
    } else if (step === 'stage') {
      setStep('pipeline');
      setSelectedPipeline(null);
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'list':
        return 'Map Planning Center List to Pipeline';
      case 'pipeline':
        return 'Select Target Pipeline';
      case 'stage':
        return 'Select Target Stage';
      default:
        return 'Map List to Pipeline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'list' && (
            <PlanningCenterListBrowser
              integrationId={integrationId}
              onSelectList={handleListSelect}
              selectedListId={selectedList?.id}
            />
          )}

          {step === 'pipeline' && (
            <FlowSelectionStep
              pipelines={pipelines || []}
              loading={false}
              onSelect={handlePipelineSelect}
            />
          )}

          {step === 'stage' && selectedPipeline && (
            <StageSelectionStep
              stages={stages?.map(s => ({ ...s, stage_order: 1 })) || []}
              loading={false}
              adding={createMappingMutation.isPending}
              onSelect={(stage) => handleStageSelect(stage.id)}
            />
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={step === 'list' ? handleClose : handleBack}
          >
            {step === 'list' ? (
              'Cancel'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}