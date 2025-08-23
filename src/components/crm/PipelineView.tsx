
import React, { useState } from "react";
import { Pipeline, Contact } from "@/types/crm";
import { PipelineStage } from "./PipelineStage";
import { ContactFormDialog } from "./ContactFormDialog";
import { Header } from "../layout/Header";
import { toast } from "sonner";
import { DragDropContext, DropResult } from "react-beautiful-dnd";

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

  const handleUpdateStage = (stageId: string, name: string, color: string) => {
    const updatedStages = pipeline.stages.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          name: name
        };
      }
      return stage;
    });

    const updatedPipeline = {
      ...pipeline,
      stages: updatedStages
    };

    onPipelineChange?.(updatedPipeline);
    toast.success("Column updated");
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

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    
    // Dropped outside the list
    if (!destination) return;
    
    // Check if actually moved
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    
    // Find the source and destination stages
    const sourceStage = pipeline.stages.find(stage => stage.id === source.droppableId);
    const destStage = pipeline.stages.find(stage => stage.id === destination.droppableId);
    
    if (!sourceStage || !destStage) return;
    
    // Create a new contact list
    const updatedStages = pipeline.stages.map(stage => ({ ...stage }));
    
    // Find the moved contact
    const [movedContact] = sourceStage.contacts.splice(source.index, 1);
    
    // Update contact with new stage info if needed
    let updatedContact = { ...movedContact };
    if (source.droppableId !== destination.droppableId) {
      // Status change when moving between columns
      updatedContact = {
        ...updatedContact,
        status: determineStatus(destination.droppableId)
      };
      toast.success(`Contact moved to ${destStage.name}`);
    }
    
    // Insert the contact in the destination
    const updatedDestStage = updatedStages.find(stage => stage.id === destination.droppableId);
    if (updatedDestStage) {
      const newContacts = Array.from(updatedDestStage.contacts);
      newContacts.splice(destination.index, 0, updatedContact);
      updatedDestStage.contacts = newContacts;
    }
    
    // Update source stage contacts
    const updatedSourceStage = updatedStages.find(stage => stage.id === source.droppableId);
    if (updatedSourceStage && source.droppableId !== destination.droppableId) {
      updatedSourceStage.contacts = sourceStage.contacts.filter(
        contact => contact.id !== movedContact.id
      );
    }
    
    // Update the pipeline
    const updatedPipeline = {
      ...pipeline,
      stages: updatedStages
    };
    
    onPipelineChange?.(updatedPipeline);
  };
  
  // Helper function to determine status based on stage
  const determineStatus = (stageId: string): "active" | "inactive" | "pending" => {
    // You can customize this logic based on your stages
    const stageIndex = pipeline.stages.findIndex(stage => stage.id === stageId);
    if (stageIndex === 0) return "pending";
    if (stageIndex === pipeline.stages.length - 1) return "inactive";
    return "active";
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
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            {pipeline.stages.map((stage) => (
              <PipelineStage
                key={stage.id}
                stage={stage}
                onAddContact={handleAddContact}
                onEditContact={handleEditContact}
                onDeleteContact={handleDeleteContact}
                onUpdateStage={handleUpdateStage}
              />
            ))}
          </div>
        </DragDropContext>
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
