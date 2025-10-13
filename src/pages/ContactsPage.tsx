import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extralight mb-2">People</h1>
          <p className="text-muted-foreground font-light">
            Manage all your people in one place
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Person
        </Button>
      </div>

      <ContactFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <ContactsTable
        contacts={contacts}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
      />

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
