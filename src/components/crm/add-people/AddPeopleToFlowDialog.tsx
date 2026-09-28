import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useBulkActions } from "@/hooks/useBulkActions";
import { useQueryClient } from "@tanstack/react-query";
import { useFlowContext } from "@/contexts/FlowContext";
import { Flow } from "@/types/crm";
import { Search, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { buildPhoneOrFilter } from "@/lib/phoneSearch";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}

interface AddPeopleToFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flow: Flow;
  teamMembers: TeamMember[];
  initialStageId?: string;
  onCreateNew?: (stageId: string) => void;
}

const STAGE_DEFAULT = "__stage_default__";
const UNASSIGNED = "__unassigned__";

export const AddPeopleToFlowDialog: React.FC<AddPeopleToFlowDialogProps> = ({
  open,
  onOpenChange,
  flow,
  teamMembers,
  initialStageId,
  onCreateNew,
}) => {
  const { organization } = useProfile();
  const queryClient = useQueryClient();
  const { refreshFlows } = useFlowContext();
  const { bulkAddExistingContactsToFlow, isLoading: isAdding } = useBulkActions(flow.id);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stageId, setStageId] = useState<string>(initialStageId ?? flow.stages[0]?.id ?? "");
  const [assigneeChoice, setAssigneeChoice] = useState<string>(STAGE_DEFAULT);

  // Existing contacts in this flow (to disable / show pill)
  const existingInFlow = useMemo(
    () => new Set(flow.stages.flatMap(s => s.contacts.map(c => c.id))),
    [flow]
  );

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
      setSelected(new Set());
      setStageId(initialStageId ?? flow.stages[0]?.id ?? "");
      setAssigneeChoice(STAGE_DEFAULT);
    }
  }, [open, flow.id, initialStageId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Load contacts
  useEffect(() => {
    if (!open || !organization) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from('contacts')
          .select('id, name, email, phone, avatar')
          .eq('organization_id', organization.id)
          .eq('status', 'active')
          .order('name', { ascending: true })
          .limit(500);

        if (debouncedSearch) {
          const raw = debouncedSearch;
          const phoneFilter = buildPhoneOrFilter(raw);
          if (phoneFilter) {
            // Phone-like input: try variants with/without US country code
            q = q.or(phoneFilter);
          } else {
            const s = raw.replace(/[%,]/g, '');
            q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
          }
        }

        const { data, error } = await q;
        if (error) throw error;
        if (!cancelled) setContacts((data ?? []) as ContactRow[]);
      } catch (e) {
        console.error(e);
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, organization, debouncedSearch]);

  const selectableVisible = contacts.filter(c => !existingInFlow.has(c.id));
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(c => selected.has(c.id));

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const c of selectableVisible) next.delete(c.id);
      } else {
        for (const c of selectableVisible) next.add(c.id);
      }
      return next;
    });
  };

  const stage = flow.stages.find(s => s.id === stageId);

  const resolvedAssigneeUserId = (): string | null => {
    if (assigneeChoice === STAGE_DEFAULT) {
      return stage?.default_assignee_user_id ?? null;
    }
    if (assigneeChoice === UNASSIGNED) return null;
    return assigneeChoice;
  };

  const handleSubmit = async () => {
    if (selected.size === 0 || !stageId) return;
    const ids = Array.from(selected);
    const { added, skipped } = await bulkAddExistingContactsToFlow(
      ids,
      stageId,
      resolvedAssigneeUserId()
    );

    if (added === 0 && skipped > 0) {
      toast.info("All selected people are already in this flow");
    } else if (added > 0 && skipped > 0) {
      toast.success(
        `Added ${added} ${added === 1 ? 'person' : 'people'} · Skipped ${skipped} already in flow`
      );
    } else if (added > 0) {
      toast.success(`Added ${added} ${added === 1 ? 'person' : 'people'} to ${flow.name}`);
    }

    queryClient.invalidateQueries({ queryKey: ['flows'] });
    if (added > 0) {
      await refreshFlows();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Add people to {flow.name}</DialogTitle>
          <DialogDescription>
            Pick existing contacts to enroll, or create someone new. Duplicates are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-0 flex-1 min-h-0 border-t">
          {/* LEFT: contact picker */}
          <div className="flex flex-col min-h-0 border-r">
            <div className="p-4 space-y-3 border-b">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => onCreateNew?.(stageId)}
              >
                <Plus className="h-4 w-4 mr-2" />
                New person
              </Button>
            </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  disabled={selectableVisible.length === 0}
                  className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {allVisibleSelected ? 'Clear visible' : 'Select all visible'}
                </button>
                <span>{selected.size} selected</span>
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-sm text-muted-foreground">No contacts found.</p>
                  {onCreateNew && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCreateNew(stageId)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New person
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="divide-y">
                  {contacts.map(c => {
                    const already = existingInFlow.has(c.id);
                    const isSelected = selected.has(c.id);
                    return (
                      <li
                        key={c.id}
                        className={`flex items-center gap-3 px-4 py-2.5 ${already ? 'opacity-60' : 'hover:bg-muted/50 cursor-pointer'}`}
                        onClick={() => !already && toggle(c.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={already}
                          onCheckedChange={() => !already && toggle(c.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.avatar ?? undefined} />
                          <AvatarFallback>{c.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.email || c.phone || '—'}
                          </div>
                        </div>
                        {already && (
                          <Badge variant="secondary" className="text-xs">Already in flow</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* RIGHT: destination */}
          <div className="flex flex-col p-4 gap-4 bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Step</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {flow.stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full inline-block"
                          style={{ backgroundColor: s.color || '#6B7280' }}
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Defaults to the flow's first step.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</Label>
              <Select value={assigneeChoice} onValueChange={setAssigneeChoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STAGE_DEFAULT}>
                    Use step default{stage?.default_assignee_user_id ? ` (Assigned)` : ''}
                  </SelectItem>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Override applies to all selected people.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selected.size === 0 || !stageId || isAdding}
          >
            {isAdding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add {selected.size > 0 ? selected.size : ''} {selected.size === 1 ? 'person' : 'people'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
