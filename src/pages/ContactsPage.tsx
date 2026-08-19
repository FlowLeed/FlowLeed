import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, X, UserPlus, Tag as TagIcon, Workflow, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Header } from "@/components/layout/Header";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactFilters } from "@/components/contacts/ContactFilters";
import { ContactFormDialog, FlowEnrollmentData } from "@/components/crm/ContactFormDialog";
import { BulkReassignDialog } from "@/components/crm/BulkReassignDialog";
import { BulkTagDialog } from "@/components/crm/BulkTagDialog";
import { BulkAddToFlowDialog } from "@/components/contacts/BulkAddToFlowDialog";
import { ImportContactsDialog } from "@/components/contacts/ImportContactsDialog";
import { useContacts } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Contact } from "@/types/crm";

export interface ContactFilters {
  searchTerm: string;
  assignedToUserId: string;
  flowId: string;
  lastInteractionDays: string;
  engagementLevel: string;
  campusId: string;
  signal: string;
  markerKey: string;
  tag: string;
}

const ContactsPage = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [searchParams] = useSearchParams();
  const initialEngagement = (() => {
    const v = searchParams.get("engagementLevel");
    if (v === "unscored") return "none";
    return v && ["highly_engaged", "active", "at_risk", "inactive", "new", "none"].includes(v)
      ? v
      : "all";
  })();
  const initialCampus = searchParams.get("campusId") || "all";
  const initialSignal = searchParams.get("signal") || "all";
  const initialMarker = searchParams.get("marker") || "all";
  const [filters, setFilters] = useState<ContactFilters>({
    searchTerm: "",
    assignedToUserId: "all",
    flowId: "all",
    lastInteractionDays: "all",
    engagementLevel: initialEngagement,
    campusId: initialCampus,
    signal: initialSignal,
    markerKey: initialMarker,
    tag: "all",
  });


  const { organization } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { contacts, isLoading } = useContacts(filters);
  const { data: orgMembers = [], isLoading: orgMembersLoading } = useOrgMembers(user?.id, true);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addToFlowOpen, setAddToFlowOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [addTagsOpen, setAddTagsOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const teamMembers = useMemo(
    () => orgMembers.map((m) => ({ id: m.user_id, name: m.full_name, avatar: m.avatar_url || undefined })),
    [orgMembers]
  );

  const handleBulkReassign = async (userId: string | null) => {
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('contacts')
        .update({ assigned_to_user_id: userId, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} ${ids.length === 1 ? 'person' : 'people'} reassigned`);
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      setReassignOpen(false);
      clearSelection();
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to reassign');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkAddTags = async (tags: string[]) => {
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const { data: existing } = await supabase
        .from('contact_tags')
        .select('contact_id, tag')
        .in('contact_id', ids)
        .in('tag', tags);
      const existingSet = new Set((existing ?? []).map((r: any) => `${r.contact_id}::${r.tag}`));
      const inserts: { contact_id: string; tag: string }[] = [];
      for (const id of ids) {
        for (const tag of tags) {
          if (!existingSet.has(`${id}::${tag}`)) inserts.push({ contact_id: id, tag });
        }
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from('contact_tags').insert(inserts);
        if (error) throw error;
      }
      toast.success(`Tags added to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`);
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      setAddTagsOpen(false);
      clearSelection();
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to add tags');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ContactFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      searchTerm: "",
      assignedToUserId: "all",
      flowId: "all",
      lastInteractionDays: "all",
      engagementLevel: "all",
      campusId: "all",
      signal: "all",
      markerKey: "all",
      tag: "all",
    });
  };

  const hasActiveFilters = 
    filters.searchTerm !== "" ||
    filters.assignedToUserId !== "all" ||
    filters.flowId !== "all" ||
    filters.lastInteractionDays !== "all" ||
    filters.engagementLevel !== "all" ||
    filters.campusId !== "all" ||
    filters.signal !== "all" ||
    filters.markerKey !== "all" ||
    filters.tag !== "all";


  const handleSaveContact = async (contact: Contact, flowData?: FlowEnrollmentData | null) => {
    if (!organization) {
      toast.error("Organization not found");
      return;
    }

    try {
      // Resolve assigned user ID from assignee name
      let assignedUserId: string | null = null;
      if (contact.assignedTo?.name) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`full_name.ilike.%${contact.assignedTo.name}%,email.ilike.%${contact.assignedTo.name}%`)
          .limit(1);
        
        if (profiles?.[0]) {
          assignedUserId = profiles[0].user_id;
        }
      }

      // Insert contact
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          name: contact.name,
          email: contact.email || null,
          phone: contact.phone || null,
          status: contact.status || 'active',
          organization_id: organization.id,
          assigned_to_user_id: assignedUserId,
          source_type: 'manual'
        })
        .select()
        .single();

      if (error) throw error;

      // Insert tags if present
      if (contact.tags?.length) {
        await supabase.from('contact_tags').insert(
          contact.tags.map(tag => ({
            contact_id: newContact.id,
            tag: tag
          }))
        );
      }

      // Insert demographics if any fields are filled
      const demo = contact as any;
      if (demo.birthday || demo.occupation || demo.maritalStatus || 
          demo.streetAddress || demo.city || demo.state || demo.zipCode) {
        await supabase.from('contact_demographics').insert({
          contact_id: newContact.id,
          birthday: demo.birthday || null,
          occupation: demo.occupation || null,
          marital_status: demo.maritalStatus || null
        });
        
        // Insert address if any address fields are filled
        if (demo.streetAddress || demo.city || demo.state || demo.zipCode) {
          await supabase.from('contact_addresses').insert({
            contact_id: newContact.id,
            street_address: demo.streetAddress || null,
            city: demo.city || null,
            state: demo.state || null,
            zip_code: demo.zipCode || null,
            address_type: 'home',
            is_primary: true
          });
        }
      }

      // Add to flow if requested
      if (flowData && newContact) {
        const { error: flowError } = await supabase
          .from('pipeline_contacts')
          .insert({
            contact_id: newContact.id,
            pipeline_id: flowData.pipelineId,
            stage_id: flowData.stageId,
            stage_order: flowData.stageOrder,
            assigned_to_user_id: flowData.defaultAssigneeUserId || assignedUserId || null,
            source_type: 'manual'
          });

        if (flowError) {
          console.error('Error adding contact to flow:', flowError);
          toast.warning(`Contact "${contact.name}" created, but failed to add to flow`);
          queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
          setShowAddDialog(false);
          return;
        }
        
        // Dispatch event to refresh FlowContext so the contact appears in the flow view
        window.dispatchEvent(new CustomEvent('flow-assignment-updated'));
        toast.success(`Contact "${contact.name}" added and enrolled in flow!`);
      } else {
        toast.success(`Contact "${contact.name}" added successfully!`);
      }

      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      setShowAddDialog(false);
      
    } catch (error: any) {
      console.error('Error saving contact:', error);
      toast.error(`Failed to save contact: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="People"
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => setShowImportDialog(true)}
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button 
              variant="outline" 
              onClick={() => setShowAddDialog(true)}
              size="icon"
              className="h-8 w-8"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
        <div className="mb-6">
          <ContactFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
        <ContactsTable
          contacts={contacts}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg p-3 md:p-4 w-[min(640px,calc(100vw-2rem))]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-semibold text-sm">
              {selectedIds.size} {selectedIds.size === 1 ? 'person' : 'people'} selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setAddToFlowOpen(true)} disabled={bulkLoading}>
                <Workflow className="h-4 w-4 mr-2" />
                Add to Flow
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)} disabled={bulkLoading}>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign To
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAddTagsOpen(true)} disabled={bulkLoading}>
                <TagIcon className="h-4 w-4 mr-2" />
                Add Tags
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} disabled={bulkLoading}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <BulkAddToFlowDialog
        open={addToFlowOpen}
        onOpenChange={setAddToFlowOpen}
        contactIds={Array.from(selectedIds)}
        onSuccess={clearSelection}
      />

      <BulkReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        teamMembers={teamMembers}
        isLoading={orgMembersLoading}
        onConfirm={handleBulkReassign}
      />

      <BulkTagDialog
        open={addTagsOpen}
        onOpenChange={setAddTagsOpen}
        mode="add"
        onConfirm={handleBulkAddTags}
      />

      <ImportContactsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        organizationId={organization?.id}
      />

      <ContactFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        contact={null}
        onSave={handleSaveContact}
      />
    </div>
  );
};

export default ContactsPage;
