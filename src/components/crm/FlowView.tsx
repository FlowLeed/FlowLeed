import React, { useState, useEffect, useMemo } from "react";
import { Flow, Contact } from "@/types/crm";
import { FlowStage } from "./FlowStage";
import { FlowTableView } from "./FlowTableView";
import { ContactFormDialog } from "./ContactFormDialog";
import { FlowSettingsDialog } from "./FlowSettingsDialog";
import { BulkActionsToolbar } from "./BulkActionsToolbar";
import { FlowCompletionConfetti } from "./FlowCompletionConfetti";
import { FlowResourcesDrawer } from "./FlowResourcesDrawer";
import { Header } from "../layout/Header";
import { toast } from "sonner";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useFlowTeamMembers } from "@/hooks/useFlowTeamMembers";
import { useBulkActions } from "@/hooks/useBulkActions";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(() => {
    const saved = localStorage.getItem(`flow-view-mode-${flow.id}`);
    return (saved === 'table' || saved === 'kanban') ? saved : 'kanban';
  });
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const { organization } = useProfile();
  const queryClient = useQueryClient();

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem(`flow-view-mode-${flow.id}`, viewMode);
  }, [viewMode, flow.id]);
  
  // Use flow team members instead of organization members
  const { teamMembers: flowTeamMembers, loading: teamMembersLoading } = useFlowTeamMembers(flow.id);
  
  const teamMembers: TeamMember[] = flowTeamMembers.map(m => ({
    id: m.user_id,
    name: m.full_name || m.email,
    email: m.email,
    avatar: m.avatar_url || undefined,
  }));


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

  const handleUpdateStage = (stageId: string, name: string, color: string, defaultAssigneeId?: string | null) => {
    const assigneeProfile = defaultAssigneeId
      ? teamMembers.find(m => m.id === defaultAssigneeId)
      : undefined;

    const updatedStages = flow.stages.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          name: name,
          color: color,
          default_assignee_user_id: defaultAssigneeId || undefined,
          defaultAssignee: assigneeProfile
            ? { name: assigneeProfile.name, avatar: assigneeProfile.avatar }
            : undefined
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
    
    // Get the moved contact without mutating the original array
    const movedContact = sourceStage.contacts[source.index];
    
    // Update contact with new stage info if needed
    let updatedContact = { ...movedContact };
    if (source.droppableId !== destination.droppableId) {
      // Status change when moving between columns
      updatedContact = {
        ...updatedContact,
        status: determineStatus(destination.droppableId),
        stageEnteredAt: new Date().toISOString() // Set stage entry time on drag-drop
      };
      
      // Auto-assign if destination stage has a default assignee
      if (destStage.default_assignee_user_id) {
        const assignee = teamMembers.find(m => m.id === destStage.default_assignee_user_id);
        if (assignee) {
          updatedContact.assignedTo = {
            name: assignee.name,
            avatar: assignee.avatar
          };
        }
      }
      
      toast.success(`Contact moved to ${destStage.name}`);
      
      // Trigger confetti if moved to completion stage
      if (destStage.is_end_step) {
        setShowConfetti(true);
      }
    }
    
    // Create updated stages with immutable operations
    const updatedStages = flow.stages.map(stage => {
      if (stage.id === source.droppableId) {
        // Remove contact from source stage
        return {
          ...stage,
          contacts: stage.contacts.filter((_, index) => index !== source.index)
        };
      }
      if (stage.id === destination.droppableId) {
        // Add contact to destination stage at the correct position
        const newContacts = [...stage.contacts];
        newContacts.splice(destination.index, 0, updatedContact);
        return {
          ...stage,
          contacts: newContacts
        };
      }
      return { ...stage };
    });
    
    // Update the flow
    const updatedFlow = {
      ...flow,
      stages: updatedStages
    };
    
    // Delay state update to let react-beautiful-dnd finish its animation
    requestAnimationFrame(() => {
      onFlowChange?.(updatedFlow);
    });
  };
  
  // Helper function to determine status based on stage
  const determineStatus = (stageId: string): "active" | "inactive" | "pending" => {
    // You can customize this logic based on your stages
    const stageIndex = flow.stages.findIndex(stage => stage.id === stageId);
    if (stageIndex === 0) return "pending";
    if (stageIndex === flow.stages.length - 1) return "inactive";
    return "active";
  };

  // Selection handlers
  const handleToggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedContacts(new Set());
  };

  const handleToggleContact = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(contactId)) {
        newSelected.delete(contactId);
      } else {
        newSelected.add(contactId);
      }
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    const allContactIds = flow.stages.flatMap(stage => 
      stage.contacts.map(c => c.id)
    );
    setSelectedContacts(new Set(allContactIds));
  };

  const handleClearSelection = () => {
    setSelectedContacts(new Set());
  };

  // Bulk actions
  const { bulkChangeStage, bulkReassign, bulkAddTags, bulkRemoveTags, bulkDelete, bulkMoveToFlow, isLoading: bulkLoading } = useBulkActions(flow.id);

  const handleBulkStageChange = async (stageId: string) => {
    const success = await bulkChangeStage(Array.from(selectedContacts), stageId);
    if (success) {
      window.location.reload();
    }
  };

  const handleBulkReassign = async (userId: string | null) => {
    const success = await bulkReassign(Array.from(selectedContacts), userId);
    if (success) {
      window.location.reload();
    }
  };

  const handleBulkAddTags = async (tags: string[]) => {
    const success = await bulkAddTags(Array.from(selectedContacts), tags);
    if (success) {
      window.location.reload();
    }
  };

  const handleBulkRemoveTags = async (tags: string[]) => {
    const success = await bulkRemoveTags(Array.from(selectedContacts), tags);
    if (success) {
      window.location.reload();
    }
  };

  const handleBulkDelete = async () => {
    const success = await bulkDelete(Array.from(selectedContacts));
    if (success) {
      window.location.reload();
    }
  };

  const handleBulkMoveToFlow = async (targetPipelineId: string, targetStageId: string) => {
    const success = await bulkMoveToFlow(Array.from(selectedContacts), targetPipelineId, targetStageId);
    if (success) {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header 
        title={flow.name}
        showFlowIcon={true}
        onAddClick={() => {
          setCurrentStageId(flow.stages[0].id);
          setCurrentContact(null);
          setIsFormOpen(true);
        }}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onDocsClick={() => setIsDocsOpen(true)}
        teamMembers={teamMembers}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        contactCounts={contactCounts}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isSelectMode={isSelectMode}
        onToggleSelectMode={handleToggleSelectMode}
        onSelectAll={handleSelectAll}
      />
      <div className="flex-1 overflow-auto p-6" style={{ backgroundColor: '#FAFAFA' }}>
        {viewMode === 'kanban' ? (
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
                  pipelineId={flow.id}
                  isSelectMode={isSelectMode}
                  selectedContacts={selectedContacts}
                  onToggleContact={handleToggleContact}
                />
              ))}
            </div>
          </DragDropContext>
        ) : (
          <FlowTableView
            flow={filteredFlow}
            onEditContact={handleEditContact}
            onDeleteContact={handleDeleteContact}
            onUpdateStage={handleUpdateStage}
            onFlowChange={onFlowChange}
            isSelectMode={isSelectMode}
            selectedContacts={selectedContacts}
            onToggleContact={handleToggleContact}
          />
        )}
      </div>
      
      {isSelectMode && selectedContacts.size > 0 && (
        <BulkActionsToolbar
          selectedCount={selectedContacts.size}
          onClearSelection={handleClearSelection}
          onStageChange={handleBulkStageChange}
          onReassign={handleBulkReassign}
          onAddTags={handleBulkAddTags}
          onRemoveTags={handleBulkRemoveTags}
          onDelete={handleBulkDelete}
          onMoveToFlow={handleBulkMoveToFlow}
          stages={flow.stages}
          teamMembers={teamMembers}
          currentPipelineId={flow.id}
          currentPipelineName={flow.name}
          isLoading={bulkLoading}
        />
      )}
      {isFormOpen && (
        <ContactFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          contact={currentContact}
          onSave={handleSaveContact}
          flowId={flow.id}
        />
      )}
      {isSettingsOpen && organization && (
        <FlowSettingsDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          flowId={flow.id}
          flowName={flow.name}
          flowDescription={flow.description}
          flowIcon={flow.icon}
          flowStages={flow.stages.map((s, index) => ({
            id: s.id,
            name: s.name,
            color: s.color || '#3b82f6',
            stage_order: index,
            is_start_step: s.is_start_step,
            is_end_step: s.is_end_step
          }))}
          organizationId={organization.id}
          onSave={() => {
            window.location.reload();
          }}
        />
      )}
      {showConfetti && (
        <FlowCompletionConfetti onComplete={() => setShowConfetti(false)} />
      )}
      {organization && (
        <FlowResourcesDrawer
          open={isDocsOpen}
          onOpenChange={setIsDocsOpen}
          flow={flow}
          organizationId={organization.id}
        />
      )}
    </div>
  );
};