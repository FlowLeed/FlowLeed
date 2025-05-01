
import React, { useState } from "react";
import { Pipeline, Contact } from "@/types/crm";
import { PipelineStage } from "./PipelineStage";
import { ContactFormDialog } from "./ContactFormDialog";
import { Header } from "../layout/Header";
import { toast } from "sonner";

interface PipelineViewProps {
  pipeline: Pipeline;
  onPipelineChange?: (pipeline: Pipeline) => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({ 
  pipeline, 
  onPipelineChange 
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);

  const handleAddContact = (stageId: string) => {
    setCurrentContact(null);
    setCurrentStageId(stageId);
    setIsFormOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setCurrentContact(contact);
    setIsFormOpen(true);
  };

  const handleDeleteContact = (contactId: string, stageId: string) => {
    const updatedStages = pipeline.stages.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          contacts: stage.contacts.filter(contact => contact.id !== contactId)
        };
      }
      return stage;
    });

    const updatedPipeline = {
      ...pipeline,
      stages: updatedStages
    };

    onPipelineChange?.(updatedPipeline);
    toast.success("Contact deleted");
  };

  const handleSaveContact = (contact: Contact) => {
    let updatedStages = [...pipeline.stages];

    if (currentContact) {
      // Edit existing contact
      updatedStages = updatedStages.map(stage => {
        return {
          ...stage,
          contacts: stage.contacts.map(c => 
            c.id === contact.id ? contact : c
          )
        };
      });
      toast.success("Contact updated");
    } else if (currentStageId) {
      // Add new contact
      updatedStages = updatedStages.map(stage => {
        if (stage.id === currentStageId) {
          return {
            ...stage,
            contacts: [...stage.contacts, contact]
          };
        }
        return stage;
      });
      toast.success("Contact added");
    }

    const updatedPipeline = {
      ...pipeline,
      stages: updatedStages
    };

    onPipelineChange?.(updatedPipeline);
    setIsFormOpen(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header 
        title={pipeline.name} 
        onAddClick={() => {
          setCurrentStageId(pipeline.stages[0].id);
          setCurrentContact(null);
          setIsFormOpen(true);
        }}
      />
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4">
          {pipeline.stages.map((stage) => (
            <PipelineStage
              key={stage.id}
              stage={stage}
              onAddContact={handleAddContact}
              onEditContact={handleEditContact}
              onDeleteContact={handleDeleteContact}
            />
          ))}
        </div>
      </div>
      {isFormOpen && (
        <ContactFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          contact={currentContact}
          onSave={handleSaveContact}
        />
      )}
    </div>
  );
};
