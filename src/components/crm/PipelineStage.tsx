
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
  // Stage color mapping
  const getStageColor = (stageName: string) => {
    const name = stageName.toLowerCase();
    if (name.includes('new')) return 'bg-blue-100 border-blue-200 text-blue-800';
    if (name.includes('connect')) return 'bg-green-100 border-green-200 text-green-800';
    if (name.includes('response') || name.includes('plan')) return 'bg-cyan-100 border-cyan-200 text-cyan-800';
    if (name.includes('follow') || name.includes('check')) return 'bg-orange-100 border-orange-200 text-orange-800';
    if (name.includes('integration')) return 'bg-teal-100 border-teal-200 text-teal-800';
    if (name.includes('placement') || name.includes('flow')) return 'bg-purple-100 border-purple-200 text-purple-800';
    return 'bg-gray-100 border-gray-200 text-gray-800';
  };

  return (
    <div className="w-80 flex-shrink-0 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Stage Header */}
      <div className={`px-4 py-3 rounded-t-lg border-b ${getStageColor(stage.name)}`}>
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-sm">{stage.name}</h3>
          <button 
            className="p-1 rounded hover:bg-white/20 transition-colors"
            onClick={() => onAddContact?.(stage.id)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Stage Content */}
      <div className="p-4">
        <Droppable droppableId={stage.id}>
          {(provided, snapshot) => (
            <div
              className={`space-y-3 min-h-[400px] transition-colors ${
                snapshot.isDraggingOver ? "bg-blue-50/30 rounded-lg" : ""
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
                      className={`transition-all ${
                        snapshot.isDragging ? "shadow-lg scale-105 rotate-2" : ""
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
              
              {/* Add Contact Button */}
              <button
                onClick={() => onAddContact?.(stage.id)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
};
