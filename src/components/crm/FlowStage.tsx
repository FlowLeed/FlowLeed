import React, { useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { FlowStage as FlowStageType, Contact } from "@/types/crm";
import { ContactCard } from "./ContactCard";
import { ColumnSettingsDialog } from "./ColumnSettingsDialog";
import { Badge } from "@/components/ui/badge";
import { Droppable, Draggable } from "react-beautiful-dnd";
interface FlowStageProps {
  stage: FlowStageType;
  onAddContact?: (stageId: string) => void;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: string, stageId: string) => void;
  onUpdateStage?: (stageId: string, name: string, color: string) => void;
  pipelineId?: string;
  isSelectMode?: boolean;
  selectedContacts?: Set<string>;
  onToggleContact?: (contactId: string) => void;
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
export const FlowStage: React.FC<FlowStageProps> = ({
  stage,
  onAddContact,
  onEditContact,
  onDeleteContact,
  onUpdateStage,
  pipelineId,
  isSelectMode = false,
  selectedContacts = new Set(),
  onToggleContact
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const stageColor = stage.color || getStageColor(stage.name);
  const handleSaveSettings = (name: string, color: string) => {
    onUpdateStage?.(stage.id, name, color);
  };
  return <>
      <div style={{
      borderColor: stageColor
    }} className="flow-column w-72 flex-shrink-0 bg-transparent p-3 border shadow-sm rounded-xl flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button className="w-3 h-3 rounded-full cursor-pointer hover:scale-110 transition-transform" style={{
            backgroundColor: stageColor
          }} onClick={() => setShowSettings(true)} />
            <h3 className="text-gray-700 font-normal">{stage.name}</h3>
            {stage.is_end_step && (
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Completed
              </Badge>
            )}
          </div>
          <button className="p-1 rounded-full hover:bg-gray-100" onClick={() => onAddContact?.(stage.id)}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      
        <Droppable droppableId={stage.id}>
          {(provided, snapshot) => <div className={`space-y-3 min-h-[200px] flex-1 p-2 rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-blue-50" : ""}`} ref={provided.innerRef} {...provided.droppableProps}>
              {stage.contacts.map((contact, index) => <Draggable key={contact.id} draggableId={contact.id} index={index}>
                  {(provided, snapshot) => <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`transition-shadow ${snapshot.isDragging ? "shadow-lg" : ""}`}>
                      <ContactCard contact={contact} onEdit={() => onEditContact?.(contact)} onDelete={() => onDeleteContact?.(contact.id, stage.id)} pipelineId={pipelineId} isSelectMode={isSelectMode} isSelected={selectedContacts.has(contact.id)} onToggleSelect={() => onToggleContact?.(contact.id)} />
                    </div>}
                </Draggable>)}
              {provided.placeholder}
            </div>}
        </Droppable>
      </div>

      <ColumnSettingsDialog open={showSettings} onOpenChange={setShowSettings} columnName={stage.name} columnColor={stageColor} onSave={handleSaveSettings} />
    </>;
};