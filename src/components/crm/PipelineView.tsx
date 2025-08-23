
import React, { useState } from "react";
import { Pipeline, Contact } from "@/types/crm";
import { PipelineStage } from "./PipelineStage";
import { ContactFormDialog } from "./ContactFormDialog";
import { Header } from "../layout/Header";
import { toast } from "sonner";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

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
  const { organization } = useProfile();

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
          name: name,
          color: color
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

  const handleSaveContact = async (contact: Contact) => {
    if (!organization) {
      toast.error("Organization not found");
      return;
    }

    try {
      if (currentContact) {
        // Update existing contact in database
        const { error: contactError } = await supabase
          .from('contacts')
          .update({
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            status: contact.status,
            notes: contact.notes || null
          })
          .eq('id', contact.id);

        if (contactError) throw contactError;

        // Update contact tags
        await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', contact.id);

        if (contact.tags && contact.tags.length > 0) {
          const tagInserts = contact.tags.map(tag => ({
            contact_id: contact.id,
            tag: tag
          }));

          const { error: tagError } = await supabase
            .from('contact_tags')
            .insert(tagInserts);

          if (tagError) throw tagError;
        }

        toast.success("Contact updated");
      } else if (currentStageId) {
        // Create new contact in database
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            status: contact.status,
            notes: contact.notes || null,
            organization_id: organization.id
          })
          .select()
          .single();

        if (contactError) throw contactError;

        // Add contact tags
        if (contact.tags && contact.tags.length > 0) {
          const tagInserts = contact.tags.map(tag => ({
            contact_id: newContact.id,
            tag: tag
          }));

          const { error: tagError } = await supabase
            .from('contact_tags')
            .insert(tagInserts);

          if (tagError) throw tagError;
        }

        // Link contact to pipeline stage
        const { error: pipelineContactError } = await supabase
          .from('pipeline_contacts')
          .insert({
            pipeline_id: pipeline.id,
            stage_id: currentStageId,
            contact_id: newContact.id,
            stage_order: 0 // Add at the beginning
          });

        if (pipelineContactError) throw pipelineContactError;

        toast.success("Contact added to flow");
      }

      // Trigger a data refresh by calling updatePipeline
      // This will cause the PipelineContext to reload the pipeline data from the database
      if (onPipelineChange) {
        // Force a reload by passing the pipeline - this will trigger updatePipeline 
        // which reloads data from database due to our recent changes
        window.location.reload();
      }
      
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error(`Failed to save contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
