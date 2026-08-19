import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Flow, Contact } from "@/types/crm";
import { FlowStage } from "./FlowStage";
import { FlowTableView } from "./FlowTableView";

import { ContactFormDialog } from "./ContactFormDialog";
import { FlowSettingsDialog } from "./FlowSettingsDialog";
import { BulkActionsToolbar } from "./BulkActionsToolbar";
import { FlowCompletionConfetti } from "./FlowCompletionConfetti";
import { AddPeopleToFlowDialog } from "./add-people/AddPeopleToFlowDialog";
import { ImportContactsDialog } from "@/components/contacts/ImportContactsDialog";
import { Header } from "../layout/Header";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useFlowTeamMembers } from "@/hooks/useFlowTeamMembers";
import { useBulkActions } from "@/hooks/useBulkActions";
import { toCsv, downloadCsv, sanitizeFilename } from "@/lib/csvExport";

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
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddPeopleOpen, setIsAddPeopleOpen] = useState(false);
  const [addPeopleStageId, setAddPeopleStageId] = useState<string | undefined>(undefined);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [selectedEngagementFilter, setSelectedEngagementFilter] = useState<string | null>(null);
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(() => {
    const saved = localStorage.getItem(`flow-view-mode-${flow.id}`);
    if (saved === 'table' || saved === 'kanban') return saved;
    // Default to table view on mobile for readability
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'table';
    return 'kanban';
  });
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
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


  // Fetch engagement scores for all contacts in this flow when engagement filter is active
  const allContactIds = useMemo(() => 
    flow.stages.flatMap(s => s.contacts.map(c => c.id)),
    [flow]
  );

  const { data: engagementScores } = useQuery({
    queryKey: ['flow-engagement-scores', flow.id, allContactIds.length],
    queryFn: async () => {
      if (allContactIds.length === 0) return {};
      const batchSize = 100;
      const scores: Record<string, string> = {};
      for (let i = 0; i < allContactIds.length; i += batchSize) {
        const batch = allContactIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from('contact_engagement_scores')
          .select('contact_id, engagement_level')
          .in('contact_id', batch);
        if (data) {
          for (const row of data) {
            scores[row.contact_id] = row.engagement_level || 'new';
          }
        }
      }
      return scores;
    },
    enabled: selectedEngagementFilter != null,
    staleTime: 5 * 60 * 1000,
  });

  // Filter contacts based on selected filter, engagement filter, and showCompleted toggle
  const filteredFlow = useMemo(() => {
    const filteredStages = flow.stages.map(stage => ({
      ...stage,
      contacts: stage.contacts.filter(contact => {
        // Filter out completed contacts if showCompleted is false
        if (!showCompleted && contact.completedEndAt) {
          return false;
        }

        // Apply engagement level filter
        if (selectedEngagementFilter && engagementScores) {
          const level = engagementScores[contact.id];
          if (level !== selectedEngagementFilter) return false;
        }

        // Apply campus filter
        if (selectedCampusFilter) {
          if (contact.campusId !== selectedCampusFilter) return false;
        }

        // Apply assignment filter
        if (selectedFilter) {
          if (selectedFilter === "unassigned") {
            return !contact.assignedTo;
          }
          
          // Find the team member by ID and match with contact's assignedTo
          const teamMember = teamMembers.find(member => member.id === selectedFilter);
          if (!teamMember || !contact.assignedTo) return false;
          
          // Match by name or email
          return contact.assignedTo.name === teamMember.name || 
                 contact.assignedTo.name === teamMember.email;
        }
        
        return true;
      })
    }));

    return {
      ...flow,
      stages: filteredStages
    };
  }, [flow, selectedFilter, selectedEngagementFilter, selectedCampusFilter, engagementScores, teamMembers, showCompleted]);

  // Calculate contact counts for filter badges (only count active, non-completed contacts)
  const contactCounts = useMemo(() => {
    const activeContacts = flow.stages.flatMap(stage => 
      stage.contacts.filter(c => !c.completedEndAt)
    );
    const byMember: Record<string, number> = {};
    
    teamMembers.forEach(member => {
      byMember[member.id] = activeContacts.filter(contact => 
        contact.assignedTo && 
        (contact.assignedTo.name === member.name || contact.assignedTo.name === member.email)
      ).length;
    });

    return {
      all: activeContacts.length,
      unassigned: activeContacts.filter(contact => !contact.assignedTo).length,
      byMember
    };
  }, [flow, teamMembers]);

  // Count completed contacts
  const completedCount = useMemo(() => {
    return flow.stages.flatMap(stage => stage.contacts).filter(c => c.completedEndAt).length;
  }, [flow]);

  const handleAddContact = (stageId: string) => {
    setCurrentContact(null);
    setCurrentStageId(stageId);
    setIsFormOpen(true);
  };

  const handleAddPeopleToStage = (stageId: string) => {
    setAddPeopleStageId(stageId);
    setIsAddPeopleOpen(true);
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
    if (!movedContact) return;

    const isCrossStage = source.droppableId !== destination.droppableId;

    // Update contact with new stage info if needed
    let updatedContact = { ...movedContact };
    if (isCrossStage) {
      updatedContact = {
        ...updatedContact,
        status: determineStatus(destination.droppableId),
        stageEnteredAt: new Date().toISOString(),
      };

      // Auto-assign if destination stage has a default assignee
      if (destStage.default_assignee_user_id) {
        const assignee = teamMembers.find(m => m.id === destStage.default_assignee_user_id);
        if (assignee) {
          updatedContact.assignedTo = {
            name: assignee.name,
            avatar: assignee.avatar,
          };
        }
      }

      toast.success(`Contact moved to ${destStage.name}`);

      if (destStage.is_end_step) {
        setShowConfetti(true);
      }
    }

    // Create updated stages with immutable operations
    const updatedStages = flow.stages.map(stage => {
      if (stage.id === source.droppableId) {
        return {
          ...stage,
          contacts: stage.contacts.filter((_, index) => index !== source.index),
        };
      }
      if (stage.id === destination.droppableId) {
        const newContacts = [...stage.contacts];
        newContacts.splice(destination.index, 0, updatedContact);
        return { ...stage, contacts: newContacts };
      }
      return { ...stage };
    });

    const updatedFlow = { ...flow, stages: updatedStages };

    // Optimistic UI update (keep rAF to avoid react-beautiful-dnd animation invariant)
    requestAnimationFrame(() => {
      onFlowChange?.(updatedFlow);
    });

    // Persist ONLY the moved row directly — fast, reliable, refresh-safe.
    // (Avoids the heavy whole-flow updateFlow loop racing against page refresh.)
    (async () => {
      try {
        const updateData: Record<string, any> = {
          stage_id: destination.droppableId,
          stage_order: destination.index,
        };

        if (isCrossStage) {
          updateData.stage_entered_at = new Date().toISOString();
          if (destStage.default_assignee_user_id) {
            updateData.assigned_to_user_id = destStage.default_assignee_user_id;
          }
          if (destStage.is_end_step) {
            updateData.completed_end_at = new Date().toISOString();
          } else {
            updateData.completed_end_at = null;
          }
        }

        const { error } = await supabase
          .from('pipeline_contacts')
          .update(updateData)
          .eq('contact_id', movedContact.id)
          .eq('pipeline_id', flow.id);

        if (error) throw error;

        // Invalidate dependent queries so other views reflect the move
        queryClient.invalidateQueries({ queryKey: ['flows'] });
        queryClient.invalidateQueries({ queryKey: ['contact', movedContact.id] });
      } catch (err) {
        console.error('Failed to persist drag move:', err);
        toast.error('Failed to save move. Reverting.');
        // Revert optimistic UI
        onFlowChange?.(flow);
      }
    })();
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

  const handleExportCsv = () => {
    // If any rows are selected, export just those; otherwise export the currently filtered view.
    const useSelection = selectedContacts.size > 0;
    const rows: (string | number)[][] = [
      ["Name", "Email", "Phone", "Campus", "Assigned To", "Flow Stage", "Tags"],
    ];
    let count = 0;
    for (const stage of filteredFlow.stages) {
      for (const contact of stage.contacts) {
        if (useSelection && !selectedContacts.has(contact.id)) continue;
        rows.push([
          contact.name || "",
          contact.email || "",
          contact.phone || "",
          contact.campusName || "",
          contact.assignedTo?.name || "",
          stage.name || "",
          (contact.tags || []).join("; "),
        ]);
        count += 1;
      }
    }
    if (count === 0) {
      toast.error("No people to export");
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${sanitizeFilename(flow.name)}-${date}.csv`;
    downloadCsv(filename, toCsv(rows));
    toast.success(`Exported ${count} ${count === 1 ? "person" : "people"} to CSV`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header 
        title={flow.name}
        showFlowIcon={true}
        onAddClick={() => {
          setAddPeopleStageId(undefined);
          setIsAddPeopleOpen(true);
        }}
        onSettingsClick={() => setIsSettingsOpen(true)}
        rightContent={
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setIsImportOpen(true)} className="h-8 w-8">
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import CSV</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
        onDocsClick={() => navigate(`/flows/${flow.id}/documentation`)}
        onAnalyticsClick={() => navigate(`/flows/${flow.id}/analytics`)}
        teamMembers={teamMembers}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        contactCounts={contactCounts}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isSelectMode={isSelectMode}
        flowType={flow.flow_type}
        cycleDays={flow.cycle_days}
        onToggleSelectMode={handleToggleSelectMode}
        onSelectAll={handleSelectAll}
        showCompleted={showCompleted}
        onShowCompletedChange={setShowCompleted}
        completedCount={completedCount}
        selectedEngagementFilter={selectedEngagementFilter}
        onEngagementFilterChange={setSelectedEngagementFilter}
        selectedCampusFilter={selectedCampusFilter}
        onCampusFilterChange={setSelectedCampusFilter}
      />
      <ImportContactsDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        organizationId={organization?.id}
        lockedFlow={{
          id: flow.id,
          name: flow.name,
          stages: filteredFlow.stages.map((s) => ({ id: s.id, name: s.name })),
        }}
        defaultStageId={flow.stages[0]?.id}
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
                  onAddPeople={handleAddPeopleToStage}
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
          onExport={handleExportCsv}
          stages={flow.stages}
          teamMembers={teamMembers}
          teamMembersLoading={teamMembersLoading}
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
            is_end_step: s.is_end_step,
            description: s.description ?? null
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
      <AddPeopleToFlowDialog
        open={isAddPeopleOpen}
        onOpenChange={(open) => {
          setIsAddPeopleOpen(open);
          if (!open) setAddPeopleStageId(undefined);
        }}
        flow={flow}
        teamMembers={teamMembers}
        initialStageId={addPeopleStageId}
      />
    </div>
  );
};