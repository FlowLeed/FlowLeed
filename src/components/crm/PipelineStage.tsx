
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
  // Determine stage color based on index or stage name
  const getStageColor = (stageId: string) => {
    const colors = ['blue', 'green', 'teal', 'orange', 'purple'];
    const index = Math.abs(stageId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % colors.length;
    return colors[index];
  };

  const stageColor = getStageColor(stage.id);

  return (
    <div className="pipeline-stage">
      <div className={`stage-header stage-header-${stageColor}`}>
        <h3 className="font-semibold text-lg">{stage.name}</h3>
        <button 
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
          onClick={() => onAddContact?.(stage.id)}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      
      <div className="p-4 bg-transparent">{/*...content wrapper...*/}
      
        <Droppable droppableId={stage.id}>
          {(provided, snapshot) => (
            <div
              className={`space-y-4 min-h-[300px] transition-colors ${
                snapshot.isDraggingOver ? `bg-crm-stage-${stageColor}-light` : ""
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
                      className={`transition-all duration-200 ${
                        snapshot.isDragging ? "shadow-xl rotate-2 scale-105" : ""
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
    </div>
  );
};
