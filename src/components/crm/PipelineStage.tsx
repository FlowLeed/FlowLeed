
import React from "react";
import { Plus } from "lucide-react";
import { PipelineStage as PipelineStageType, Contact } from "@/types/crm";
import { ContactCard } from "./ContactCard";

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
    <div className="pipeline-column">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">{stage.name}</h3>
        <button 
          className="p-1 rounded-full hover:bg-gray-100"
          onClick={() => onAddContact?.(stage.id)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        {stage.contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            onEdit={() => onEditContact?.(contact)}
            onDelete={() => onDeleteContact?.(contact.id, stage.id)}
          />
        ))}
      </div>
    </div>
  );
};
