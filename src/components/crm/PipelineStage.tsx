
import React from "react";
import { Plus } from "lucide-react";
import { PipelineStage as PipelineStageType, Contact } from "@/types/crm";
import { ContactCard } from "./ContactCard";
import { Droppable, Draggable } from "react-beautiful-dnd";

interface PipelineStageProps {
  stage: PipelineStageType;
  onAddContact?: (stageId: string) => void;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: string, stageId: string) => void;
}

export const PipelineStage: React.FC<PipelineStageProps> = ({
  stage,
  onAddContact,
  onEditContact,
  onDeleteContact,
}) => {
  return (
    <div className="pipeline-column w-72 flex-shrink-0 bg-transparent p-3 rounded-[35px] border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <h3 className="font-medium text-gray-700">{stage.name}</h3>
        </div>
        <button 
          className="p-1 rounded-full hover:bg-gray-100"
          onClick={() => onAddContact?.(stage.id)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            className={`space-y-3 min-h-[200px] transition-colors ${
              snapshot.isDraggingOver ? "bg-blue-50" : ""
            }`}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {stage.contacts.map((contact, index) => (
              <Draggable key={contact.id} draggableId={contact.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`transition-shadow ${
                      snapshot.isDragging ? "shadow-lg" : ""
                    }`}
                  >
                    <ContactCard
                      contact={contact}
                      onEdit={() => onEditContact?.(contact)}
                      onDelete={() => onDeleteContact?.(contact.id, stage.id)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
