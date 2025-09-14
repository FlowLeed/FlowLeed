import React, { useState, useEffect, useMemo } from "react";
import { Flow, Contact } from "@/types/crm";
import { FlowStage } from "./FlowStage";
import { ContactFormDialog } from "./ContactFormDialog";
import { FlowTeamFilter } from "./FlowTeamFilter";
import { Header } from "../layout/Header";
import { toast } from "sonner";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  email: string;
}

interface FlowViewProps {
  flow: Flow;
  onFlowChange?: (flow: Flow) => void;
}

export const FlowView: React.FC<FlowViewProps> = ({ 
  flow, 
  onFlowChange 
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const { organization } = useProfile();
  const queryClient = useQueryClient();

  // Fetch team members when component mounts
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!organization) return;

      try {
        // First get organization members
        const { data: organizationMembers, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organization.id);

        if (membersError) throw membersError;

        if (!organizationMembers || organizationMembers.length === 0) {
          setTeamMembers([]);
          return;
        }

        // Then get profiles for those users
        const userIds = organizationMembers.map(member => member.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        const members: TeamMember[] = profiles?.map(profile => ({
          id: profile.user_id,
          name: profile.full_name || profile.email || 'Unknown User',
          email: profile.email,
          avatar: profile.avatar_url || undefined
        })) || [];

        setTeamMembers(members);
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    fetchTeamMembers();
  }, [organization]);

  // Filter contacts based on selected filter
  const filteredFlow = useMemo(() => {
    if (!selectedFilter) return flow;

    const filteredStages = flow.stages.map(stage => ({
      ...stage,
      contacts: stage.contacts.filter(contact => {
        if (selectedFilter === "unassigned") {
          return !contact.assignedTo;
        }
        
        // Find the team member by ID and match with contact's assignedTo
        const teamMember = teamMembers.find(member => member.id === selectedFilter);
        if (!teamMember || !contact.assignedTo) return false;
        
        // Match by name or email
        return contact.assignedTo.name === teamMember.name || 
               contact.assignedTo.name === teamMember.email;
      })
    }));

    return {
      ...flow,
      stages: filteredStages
    };
  }, [flow, selectedFilter, teamMembers]);

  // Calculate contact counts for filter badges
  const contactCounts = useMemo(() => {
    const allContacts = flow.stages.flatMap(stage => stage.contacts);
    const byMember: Record<string, number> = {};
    
    teamMembers.forEach(member => {
      byMember[member.id] = allContacts.filter(contact => 
        contact.assignedTo && 
        (contact.assignedTo.name === member.name || contact.assignedTo.name === member.email)
      ).length;
    });

    return {
      all: allContacts.length,
      unassigned: allContacts.filter(contact => !contact.assignedTo).length,
      byMember
    };
  }, [flow, teamMembers]);

  const handleAddContact = (stageId: string) => {
    setCurrentContact(null);
    setCurrentStageId(stageId);
    setIsFormOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setCurrentContact(contact);
    setIsFormOpen(true);
  };

  const handleDeleteContact = async (contactId: string, stageId: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from('pipeline_contacts')
        .delete()
        .eq('contact_id', contactId)
        .eq('stage_id', stageId);

      if (error) throw error;

      // Update local state
      const updatedStages = flow.stages.map(stage => {
        if (stage.id === stageId) {
          return {
            ...stage,
            contacts: stage.contacts.filter(contact => contact.id !== contactId)
          };
        }
        return stage;
      });

      const updatedFlow = {
        ...flow,
        stages: updatedStages
      };

      onFlowChange?.(updatedFlow);
      
      // Invalidate contact query to update contact profile
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      
      // Invalidate flow queries to update flow views
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      
      toast.success("Contact removed from flow");
    } catch (error) {
      console.error("Error removing contact from flow:", error);
      toast.error("Failed to remove contact from flow");
    }
  };

  const handleUpdateStage = (stageId: string, name: string, color: string) => {
    const updatedStages = flow.stages.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          name: name,
          color: color
        };
      }
      return stage;
    });

    const updatedFlow = {
      ...flow,
      stages: updatedStages
    };

    onFlowChange?.(updatedFlow);
    toast.success("Column updated");
  };

  const handleSaveContact = async (contact: Contact) => {
    if (!organization) {
      toast.error("Organization not found");
      return;
    }

    try {
      // Find the assigned user's ID if assignedTo is set
      let assignedUserId: string | null = null;
      if (contact.assignedTo?.name) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`full_name.eq.${contact.assignedTo.name},email.eq.${contact.assignedTo.name}`)
          .limit(1);

        if (!profileError && profiles && profiles.length > 0) {
          assignedUserId = profiles[0].user_id;
        }
      }

      if (currentContact) {
        // Update existing contact in database
        const { error: contactError } = await supabase
          .from('contacts')
          .update({
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            status: contact.status,
            notes: contact.notes || null,
            assigned_to_user_id: assignedUserId
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
            organization_id: organization.id,
            assigned_to_user_id: assignedUserId
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

        // Link contact to flow stage (stored as pipeline_contacts in database)
        const { error: flowContactError } = await supabase
          .from('pipeline_contacts')
          .insert({
            pipeline_id: flow.id,
            stage_id: currentStageId,
            contact_id: newContact.id,
            stage_order: 0 // Add at the beginning
          });

        if (flowContactError) throw flowContactError;

        toast.success("Contact added to flow");
      }

      // Trigger a data refresh by calling updateFlow
      // This will cause the FlowContext to reload the flow data from the database
      if (onFlowChange) {
        // Force a reload by passing the flow - this will trigger updateFlow 
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
    const sourceStage = flow.stages.find(stage => stage.id === source.droppableId);
    const destStage = flow.stages.find(stage => stage.id === destination.droppableId);
    
    if (!sourceStage || !destStage) return;
    
    // Create a new contact list
    const updatedStages = flow.stages.map(stage => ({ ...stage }));
    
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
    
    // Update the flow
    const updatedFlow = {
      ...flow,
      stages: updatedStages
    };
    
    onFlowChange?.(updatedFlow);
  };
  
  // Helper function to determine status based on stage
  const determineStatus = (stageId: string): "active" | "inactive" | "pending" => {
    // You can customize this logic based on your stages
    const stageIndex = flow.stages.findIndex(stage => stage.id === stageId);
    if (stageIndex === 0) return "pending";
    if (stageIndex === flow.stages.length - 1) return "inactive";
    return "active";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header 
        title={flow.name} 
        onAddClick={() => {
          setCurrentStageId(flow.stages[0].id);
          setCurrentContact(null);
          setIsFormOpen(true);
        }}
      />
      <FlowTeamFilter
        teamMembers={teamMembers}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        contactCounts={contactCounts}
      />
      <div className="flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            {filteredFlow.stages.map((stage) => (
              <FlowStage
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