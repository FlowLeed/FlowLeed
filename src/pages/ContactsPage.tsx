import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactFilters } from "@/components/contacts/ContactFilters";
import { ContactFormDialog, FlowEnrollmentData } from "@/components/crm/ContactFormDialog";
import { useContacts } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Contact } from "@/types/crm";

export interface ContactFilters {
  searchTerm: string;
  assignedToUserId: string;
  flowId: string;
  lastInteractionDays: string;
  engagementLevel: string;
}

const ContactsPage = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filters, setFilters] = useState<ContactFilters>({
    searchTerm: "",
    assignedToUserId: "all",
    flowId: "all",
    lastInteractionDays: "all",
    engagementLevel: "all",
  });

  const { organization } = useProfile();
  const queryClient = useQueryClient();
  const { contacts, isLoading } = useContacts(filters);
  
  console.log('📄 ContactsPage render:', { 
    contactsCount: contacts?.length,
    contactsType: typeof contacts,
    isArray: Array.isArray(contacts),
    isLoading,
    isUndefined: contacts === undefined,
    isNull: contacts === null,
    filters 
  });

  const handleFilterChange = (key: keyof ContactFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      searchTerm: "",
      assignedToUserId: "all",
      flowId: "all",
      lastInteractionDays: "all",
    });
  };

  const hasActiveFilters = 
    filters.searchTerm !== "" ||
    filters.assignedToUserId !== "all" ||
    filters.flowId !== "all" ||
    filters.lastInteractionDays !== "all";

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
          <Button 
            variant="outline" 
            onClick={() => setShowAddDialog(true)}
            size="icon"
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
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
        />
      </div>

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
