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
  onDeleteContact
}) => {
  return <div className="column-connect w-72 flex-shrink-0">
      <div className="header">
        <div className="header-icon"></div>
        <h3>{stage.name}</h3>
      </div>
      
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => <div className={`min-h-[200px] transition-colors ${snapshot.isDraggingOver ? "bg-blue-50" : ""}`} ref={provided.innerRef} {...provided.droppableProps}>
            {stage.contacts.map((contact, index) => <Draggable key={contact.id} draggableId={contact.id} index={index}>
                {(provided, snapshot) => <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`card transition-shadow ${snapshot.isDragging ? "shadow-lg" : ""}`}>
                    <ContactCard contact={contact} onEdit={() => onEditContact?.(contact)} onDelete={() => onDeleteContact?.(contact.id, stage.id)} />
                  </div>}
              </Draggable>)}
            {provided.placeholder}
          </div>}
      </Droppable>
      <button className="add-btn" onClick={() => onAddContact?.(stage.id)}>
        <Plus className="h-5 w-5" />
      </button>
    </div>;
};