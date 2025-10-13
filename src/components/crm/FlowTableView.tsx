import React, { useState, useMemo } from "react";
import { Flow, Contact, FlowStage } from "@/types/crm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FlowTableViewProps {
  flow: Flow;
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contactId: string, stageId: string) => void;
  onFlowChange?: (flow: Flow) => void;
}

type SortField = 'name' | 'stage' | 'email' | 'phone' | 'assignedTo' | 'date';
type SortDirection = 'asc' | 'desc';

interface ContactWithStage extends Contact {
  stageId: string;
  stageName: string;
  stageColor?: string;
}

export const FlowTableView: React.FC<FlowTableViewProps> = ({
  flow,
  onEditContact,
  onDeleteContact,
  onFlowChange,
}) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Flatten all contacts from all stages
  const allContacts: ContactWithStage[] = useMemo(() => {
    const contacts: ContactWithStage[] = [];
    flow.stages.forEach((stage) => {
      stage.contacts.forEach((contact) => {
        contacts.push({
          ...contact,
          stageId: stage.id,
          stageName: stage.name,
          stageColor: stage.color,
        });
      });
    });
    return contacts;
  }, [flow]);

  // Sort contacts
  const sortedContacts = useMemo(() => {
    const sorted = [...allContacts];
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'stage':
          comparison = a.stageName.localeCompare(b.stageName);
          break;
        case 'email':
          comparison = (a.email || '').localeCompare(b.email || '');
          break;
        case 'phone':
          comparison = (a.phone || '').localeCompare(b.phone || '');
          break;
        case 'assignedTo':
          comparison = (a.assignedTo?.name || '').localeCompare(b.assignedTo?.name || '');
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [allContacts, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleStageChange = async (contact: ContactWithStage, newStageId: string) => {
    if (newStageId === contact.stageId) return;

    try {
      // Update in database
      const { error } = await supabase
        .from('pipeline_contacts')
        .update({ stage_id: newStageId })
        .eq('contact_id', contact.id)
        .eq('pipeline_id', flow.id);

      if (error) throw error;

      // Update local state
      const updatedStages = flow.stages.map(stage => {
        if (stage.id === contact.stageId) {
          // Remove from old stage
          return {
            ...stage,
            contacts: stage.contacts.filter(c => c.id !== contact.id)
          };
        } else if (stage.id === newStageId) {
          // Add to new stage
          return {
            ...stage,
            contacts: [...stage.contacts, contact]
          };
        }
        return stage;
      });

      const updatedFlow = {
        ...flow,
        stages: updatedStages
      };

      onFlowChange?.(updatedFlow);
      
      const newStageName = flow.stages.find(s => s.id === newStageId)?.name || 'stage';
      toast.success(`Moved to ${newStageName}`);
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Failed to update stage");
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="name">Name</SortableHeader>
            <SortableHeader field="stage">Stage</SortableHeader>
            <SortableHeader field="email">Email</SortableHeader>
            <SortableHeader field="phone">Phone</SortableHeader>
            <SortableHeader field="assignedTo">Assigned To</SortableHeader>
            <TableHead>Tags</TableHead>
            <TableHead>Status</TableHead>
            <SortableHeader field="date">Date Added</SortableHeader>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedContacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No contacts found
              </TableCell>
            </TableRow>
          ) : (
            sortedContacts.map((contact) => (
              <TableRow 
                key={`${contact.id}-${contact.stageId}`}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onEditContact(contact)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar} alt={contact.name} />
                      <AvatarFallback>
                        {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{contact.name}</span>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={contact.stageId}
                    onValueChange={(value) => handleStageChange(contact, value)}
                  >
                    <SelectTrigger className="w-[160px] h-8">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: contact.stageColor || '#3b82f6' }}
                        />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {flow.stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: stage.color || '#3b82f6' }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.email || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.phone || '—'}
                </TableCell>
                <TableCell>
                  {contact.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={contact.assignedTo.avatar} alt={contact.assignedTo.name} />
                        <AvatarFallback className="text-xs">
                          {contact.assignedTo.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{contact.assignedTo.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap max-w-[200px]">
                    {contact.tags.length > 0 ? (
                      contact.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {contact.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{contact.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={
                      contact.status === 'active' ? 'default' : 
                      contact.status === 'inactive' ? 'secondary' : 
                      'outline'
                    }
                    className="capitalize"
                  >
                    {contact.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(contact.date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditContact(contact);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteContact(contact.id, contact.stageId);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
