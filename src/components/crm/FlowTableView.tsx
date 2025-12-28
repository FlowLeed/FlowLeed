import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Trash2, ArrowUpDown, ChevronDown, Plus, MoreVertical, Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ColumnSettingsDialog } from "./ColumnSettingsDialog";

interface FlowTableViewProps {
  flow: Flow;
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contactId: string, stageId: string) => void;
  onUpdateStage?: (stageId: string, name: string, color: string, defaultAssigneeId?: string | null) => void;
  onFlowChange?: (flow: Flow) => void;
  isSelectMode?: boolean;
  selectedContacts?: Set<string>;
  onToggleContact?: (contactId: string) => void;
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
  onUpdateStage,
  onFlowChange,
  isSelectMode = false,
  selectedContacts = new Set(),
  onToggleContact
}) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedStages, setExpandedStages] = useState<Set<string>>(
    new Set(flow.stages.map(s => s.id))
  );
  const [settingsStageId, setSettingsStageId] = useState<string | null>(null);

  // Group contacts by stage
  const contactsByStage = useMemo(() => {
    return flow.stages.map(stage => ({
      stage,
      contacts: stage.contacts.map(contact => ({
        ...contact,
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
      }))
    }));
  }, [flow.stages]);

  // Sort contacts within each stage group
  const sortedContactsByStage = useMemo(() => {
    return contactsByStage.map(group => ({
      ...group,
      contacts: [...group.contacts].sort((a, b) => {
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
      })
    }));
  }, [contactsByStage, sortField, sortDirection]);

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSaveSettings = (name: string, color: string, defaultAssigneeId?: string | null) => {
    if (settingsStageId) {
      onUpdateStage?.(settingsStageId, name, color, defaultAssigneeId);
      setSettingsStageId(null);
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
    <div className="w-full space-y-4">
      {sortedContactsByStage.map(({ stage, contacts }) => (
        <div key={stage.id} className="space-y-0 border rounded-lg overflow-hidden">
          {/* Stage Header */}
          <div 
            className="flex items-center gap-3 px-4 py-3 border-l-4 bg-background"
            style={{ borderLeftColor: stage.color || '#3b82f6' }}
          >
            <button
              onClick={() => toggleStage(stage.id)}
              className="flex items-center gap-2 flex-1 cursor-pointer hover:opacity-80"
            >
              <ChevronDown 
                className={`h-4 w-4 transition-transform ${
                  expandedStages.has(stage.id) ? '' : '-rotate-90'
                }`}
              />
              <span 
                className="font-semibold text-base"
                style={{ color: stage.color || '#3b82f6' }}
              >
                {stage.name}
              </span>
              <Badge variant="secondary" className="text-xs">
                {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
              </Badge>
              {stage.is_end_step && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </Badge>
              )}
            </button>
            
            {stage.defaultAssignee && (
              <div className="relative flex-shrink-0" title={`Auto-assigned to: ${stage.defaultAssignee.name}`}>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={stage.defaultAssignee.avatar} alt={stage.defaultAssignee.name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {stage.defaultAssignee.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="h-2 w-2 text-white" />
                </span>
              </div>
            )}
            
            <button 
              className="p-1 rounded-full hover:bg-gray-100 flex-shrink-0" 
              onClick={(e) => {
                e.stopPropagation();
                setSettingsStageId(stage.id);
              }}
              aria-label="Stage settings"
            >
              <MoreVertical className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Table for this stage */}
          {expandedStages.has(stage.id) && (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSelectMode && (
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={contacts.length > 0 && contacts.every(c => selectedContacts.has(c.id))}
                          indeterminate={
                            contacts.some(c => selectedContacts.has(c.id)) && 
                            !contacts.every(c => selectedContacts.has(c.id))
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              // Select all contacts in this stage
                              contacts.forEach(c => {
                                if (!selectedContacts.has(c.id)) {
                                  onToggleContact?.(c.id);
                                }
                              });
                            } else {
                              // Deselect all contacts in this stage
                              contacts.forEach(c => {
                                if (selectedContacts.has(c.id)) {
                                  onToggleContact?.(c.id);
                                }
                              });
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    <SortableHeader field="name">Name</SortableHeader>
                    <SortableHeader field="email">Email</SortableHeader>
                    <SortableHeader field="phone">Phone</SortableHeader>
                    <SortableHeader field="assignedTo">Assigned To</SortableHeader>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSelectMode ? 6 : 5} className="text-center text-muted-foreground py-4">
                        No contacts in this stage
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow 
                        key={contact.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          isSelectMode && selectedContacts.has(contact.id) ? 'bg-primary/5' : ''
                        } ${contact.completedEndAt ? 'opacity-50' : ''}`}
                        onClick={(e) => {
                          if (isSelectMode) {
                            e.preventDefault();
                            onToggleContact?.(contact.id);
                          } else {
                            navigate(`/contacts/${contact.id}?pipelineId=${flow.id}`);
                          }
                        }}
                      >
                        {isSelectMode && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedContacts.has(contact.id)}
                              onCheckedChange={() => onToggleContact?.(contact.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={contact.avatar} alt={contact.name} />
                              <AvatarFallback>
                                {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-light">{contact.name}</span>
                            {contact.completedEndAt && (
                              <Badge variant="secondary" className="text-xs gap-1 py-0 h-5">
                                <CheckCircle2 className="h-3 w-3" />
                                Done
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.email || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.phone || '—'}
                        </TableCell>
                        <TableCell>
                          {contact.assignedTo ? (
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={contact.assignedTo.avatar} alt={contact.assignedTo.name} />
                              <AvatarFallback className="text-xs">
                                {contact.assignedTo.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
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
                      </TableRow>
                    ))
                  )}
                  
                  {/* Add Item Row */}
                  <TableRow className="hover:bg-muted/30 border-t">
                    <TableCell colSpan={isSelectMode ? 6 : 5}>
                      <button 
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 w-full py-1"
                        onClick={() => {
                          const newContact = {
                            id: '',
                            name: '',
                            email: '',
                            phone: '',
                            avatar: '',
                            tags: [],
                            status: 'active',
                            date: new Date().toISOString(),
                            stageId: stage.id,
                          } as Contact;
                          onEditContact(newContact);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add Contact
                      </button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ))}
      
      {/* Settings Dialog */}
      {settingsStageId && (
        <ColumnSettingsDialog 
          open={true}
          onOpenChange={(open) => !open && setSettingsStageId(null)}
          columnName={flow.stages.find(s => s.id === settingsStageId)?.name || ''}
          columnColor={flow.stages.find(s => s.id === settingsStageId)?.color || '#3b82f6'}
          flowId={flow.id}
          defaultAssigneeId={flow.stages.find(s => s.id === settingsStageId)?.default_assignee_user_id}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
};
