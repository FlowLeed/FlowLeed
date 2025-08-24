import React, { useState } from "react";
import { Plus } from "lucide-react";
import { PipelineStage as PipelineStageType, Contact } from "@/types/crm";
import { ContactCard } from "./ContactCard";
import { ColumnSettingsDialog } from "./ColumnSettingsDialog";
import { Droppable, Draggable } from "react-beautiful-dnd";
interface PipelineStageProps {
  stage: PipelineStageType;
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
  const handleSaveSettings = (name: string, color: string) => {
    onUpdateStage?.(stage.id, name, color);
  };
  return <>
      <div style={{
      borderColor: stageColor
    }} className="pipeline-column w-72 flex-shrink-0 bg-transparent p-3 border shadow-sm rounded-xl">
        <div className="flex justify-between items-center mb-4">
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