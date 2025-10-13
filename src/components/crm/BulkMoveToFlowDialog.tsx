import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FlowSelectionStep } from '../contact/FlowSelectionStep';
import { StageSelectionStep } from '../contact/StageSelectionStep';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkMoveToFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPipelineId: string;
  currentPipelineName: string;
  selectedCount: number;
  onConfirm: (targetPipelineId: string, targetStageId: string) => Promise<void>;
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
}

export const BulkMoveToFlowDialog: React.FC<BulkMoveToFlowDialogProps> = ({
  open,
  onOpenChange,
  currentPipelineId,
  currentPipelineName,
  selectedCount,
  onConfirm
}) => {
  const [step, setStep] = useState<'pipeline' | 'stage'>('pipeline');
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Fetch available pipelines (excluding current one)
  const { data: availablePipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['available-pipelines', currentPipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, description, icon')
        .order('name');

      if (error) throw error;
      
      // Filter out current pipeline
      const filtered = data?.filter(p => p.id !== currentPipelineId);
      
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
        .select('id, name, color, stage_order')
        .eq('pipeline_id', selectedPipeline.id)
        .order('stage_order');

      if (error) throw error;
      return data as Stage[];
    },
    enabled: !!selectedPipeline
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

  const handleStageSelect = async (stage: Stage) => {
    if (!selectedPipeline) return;
    
    setIsMoving(true);
    try {
      await onConfirm(selectedPipeline.id, stage.id);
      handleClose();
    } finally {
      setIsMoving(false);
    }
  };

  const handleBack = () => {
    if (step === 'stage') {
      setStep('pipeline');
      setSelectedPipeline(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {step === 'stage' && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === 'pipeline' 
                ? `Move ${selectedCount} contact${selectedCount !== 1 ? 's' : ''} to Flow` 
                : `Select Stage in ${selectedPipeline?.name}`}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === 'pipeline' && (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will remove {selectedCount} contact{selectedCount !== 1 ? 's' : ''} from <strong>{currentPipelineName}</strong> and add them to the selected flow.
              </AlertDescription>
            </Alert>
            
            <FlowSelectionStep
              pipelines={availablePipelines || []}
              loading={loadingPipelines}
              onSelect={handlePipelineSelect}
            />
          </>
        )}

        {step === 'stage' && selectedPipeline && (
          <StageSelectionStep
            stages={stages || []}
            loading={loadingStages}
            onSelect={handleStageSelect}
            adding={isMoving}
          />
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose} disabled={isMoving}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};