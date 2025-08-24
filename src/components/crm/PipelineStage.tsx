import React, { useState } from "react";
import { Plus, Play, CheckCircle } from "lucide-react";
import { PipelineStage as PipelineStageType, Contact } from "@/types/crm";
import { ContactCard } from "./ContactCard";
import { ColumnSettingsDialog } from "./ColumnSettingsDialog";
import { Droppable, Draggable } from "react-beautiful-dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
interface PipelineStageProps {
  stage: PipelineStageType & {
    is_start_step?: boolean;
    is_end_step?: boolean;
  };
  onAddContact?: (stageId: string) => void;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: string, stageId: string) => void;
  onUpdateStage?: (stageId: string, name: string, color: string) => void;
}

// Default colors for different stages
const getStageColor = (stageName: string): string => {
  const colorMap: {
    [key: string]: string;
  } = {
    "New Leads": "#3B82F6",
    // blue
    "Contacted": "#F59E0B",
    // yellow
    "Qualified": "#10B981",
    // green
    "Proposal": "#8B5CF6",
    // purple
    "Closed Won": "#10B981",
    // green
    "Closed Lost": "#EF4444" // red
  };
  return colorMap[stageName] || "#6B7280"; // default gray
};
export const PipelineStage: React.FC<PipelineStageProps> = ({
  stage,
  onAddContact,
  onEditContact,
  onDeleteContact,
  onUpdateStage
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const stageColor = stage.color || getStageColor(stage.name);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStepMutation = useMutation({
    mutationFn: async ({ isStart, isEnd }: { isStart?: boolean; isEnd?: boolean }) => {
      const { error } = await supabase
        .from('pipeline_stages')
        .update({
          is_start_step: isStart ?? stage.is_start_step,
          is_end_step: isEnd ?? stage.is_end_step,
        })
        .eq('id', stage.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast({
        title: 'Stage updated',
        description: 'Progress tracking settings have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update stage settings.',
        variant: 'destructive',
      });
    },
  });

  const handleSaveSettings = (name: string, color: string) => {
    onUpdateStage?.(stage.id, name, color);
  };

  const toggleStartStep = () => {
    updateStepMutation.mutate({ isStart: !stage.is_start_step });
  };

  const toggleEndStep = () => {
    updateStepMutation.mutate({ isEnd: !stage.is_end_step });
  };
  return <>
      <div style={{
      borderColor: stageColor
    }} className="pipeline-column w-72 flex-shrink-0 bg-transparent p-3 border shadow-sm rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <button className="w-3 h-3 rounded-full cursor-pointer hover:scale-110 transition-transform" style={{
            backgroundColor: stageColor
          }} onClick={() => setShowSettings(true)} />
            <h3 className="font-medium text-gray-700">{stage.name}</h3>
          </div>
          <button className="p-1 rounded-full hover:bg-gray-100" onClick={() => onAddContact?.(stage.id)}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        {/* Progress tracking badges and controls */}
        <div className="flex items-center gap-2 mb-3">
          {stage.is_start_step && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <Play className="h-3 w-3" />
              Start
            </Badge>
          )}
          {stage.is_end_step && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              End
            </Badge>
          )}
          <div className="flex gap-1 ml-auto">
            <Button
              variant={stage.is_start_step ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={toggleStartStep}
              title="Mark as start step"
            >
              <Play className="h-3 w-3" />
            </Button>
            <Button
              variant={stage.is_end_step ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={toggleEndStep}
              title="Mark as end step"
            >
              <CheckCircle className="h-3 w-3" />
            </Button>
          </div>
        </div>
      
        <Droppable droppableId={stage.id}>
          {(provided, snapshot) => <div className={`space-y-3 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? "bg-blue-50" : ""}`} ref={provided.innerRef} {...provided.droppableProps}>
              {stage.contacts.map((contact, index) => <Draggable key={contact.id} draggableId={contact.id} index={index}>
                  {(provided, snapshot) => <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`transition-shadow ${snapshot.isDragging ? "shadow-lg" : ""}`}>
                      <ContactCard contact={contact} onEdit={() => onEditContact?.(contact)} onDelete={() => onDeleteContact?.(contact.id, stage.id)} />
                    </div>}
                </Draggable>)}
              {provided.placeholder}
            </div>}
        </Droppable>
      </div>

      <ColumnSettingsDialog open={showSettings} onOpenChange={setShowSettings} columnName={stage.name} columnColor={stageColor} onSave={handleSaveSettings} />
    </>;
};