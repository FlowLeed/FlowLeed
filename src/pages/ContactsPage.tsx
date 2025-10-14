import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactFilters } from "@/components/contacts/ContactFilters";
import { ContactFormDialog } from "@/components/crm/ContactFormDialog";
import { useContacts } from "@/hooks/useContacts";

export interface ContactFilters {
  searchTerm: string;
  assignedToUserId: string;
  flowId: string;
  lastInteractionDays: string;
}

const ContactsPage = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filters, setFilters] = useState<ContactFilters>({
    searchTerm: "",
    assignedToUserId: "all",
    flowId: "all",
    lastInteractionDays: "all",
  });

  const { contacts, isLoading } = useContacts(filters);
  
  console.log('ContactsPage - contacts:', contacts);
  console.log('ContactsPage - isLoading:', isLoading);

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

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="People"
        description="Manage all your people in one place"
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
          <div className="flex items-center gap-4">
            <ContactFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              hasActiveFilters={hasActiveFilters}
            />
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Person
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
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
        onSave={() => setShowAddDialog(false)}
      />
    </div>
  );
};

export default ContactsPage;
