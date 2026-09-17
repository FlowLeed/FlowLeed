import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FlowSelectionStep } from '../contact/FlowSelectionStep';
import { StageSelectionStep } from '../contact/StageSelectionStep';
import { ArrowLeft, Search } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
  stage_order: number;
  default_assignee_user_id?: string | null;
}

interface PersonRow {
  id: string;
  name: string;
  email: string | null;
  campusName: string | null;
}

interface BulkAddToFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  onSuccess?: () => void;
  /** Show a review-and-deselect step before choosing the Flow (used by the AI chat). */
  reviewFirst?: boolean;
}

export const BulkAddToFlowDialog: React.FC<BulkAddToFlowDialogProps> = ({
  open,
  onOpenChange,
  contactIds,
  onSuccess,
  reviewFirst = false,
}) => {
  const [step, setStep] = useState<'review' | 'pipeline' | 'stage'>(reviewFirst ? 'review' : 'pipeline');
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(contactIds);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { organization } = useProfile();

  useEffect(() => {
    setSelectedIds(contactIds);
    setStep(reviewFirst ? 'review' : 'pipeline');
  }, [contactIds, reviewFirst, open]);

  const { data: people, isLoading: loadingPeople } = useQuery({
    queryKey: ['bulk-add-review-people', contactIds],
    queryFn: async (): Promise<PersonRow[]> => {
      const chunks: string[][] = [];
      for (let i = 0; i < contactIds.length; i += 150) chunks.push(contactIds.slice(i, i + 150));
      const rows: any[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, name, email, campuses(name)')
          .eq('organization_id', organization?.id ?? '')
          .in('id', chunk);
        if (error) throw error;
        rows.push(...(data ?? []));
      }
      return rows
        .map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email ?? null,
          campusName: (r.campuses as any)?.name ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: open && reviewFirst && contactIds.length > 0 && !!organization?.id,
  });

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = people ?? [];
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || (p.campusName ?? '').toLowerCase().includes(q),
    );
  }, [people, search]);

  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['bulk-add-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, description, icon')
        .order('name');
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: open,
  });

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ['bulk-add-stages', selectedPipeline?.id],
    queryFn: async () => {
      if (!selectedPipeline) return [];
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, stage_order, default_assignee_user_id')
        .eq('pipeline_id', selectedPipeline.id)
        .order('stage_order');
      if (error) throw error;
      return data as Stage[];
    },
    enabled: !!selectedPipeline,
  });

  const addMutation = useMutation({
    mutationFn: async (stage: Stage) => {
      if (!selectedPipeline) throw new Error('No flow selected');
      const ids = selectedIds;

      const { data: verifiedContacts, error: verifyError } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', organization?.id ?? '')
        .in('id', ids);
      if (verifyError) throw verifyError;
      const verifiedIds = (verifiedContacts ?? []).map((contact) => contact.id);
      if (verifiedIds.length !== ids.length) throw new Error('Some people are no longer available in this organization.');

      // Skip contacts already in this flow
      const { data: existing, error: existErr } = await supabase
        .from('pipeline_contacts')
        .select('contact_id')
        .eq('pipeline_id', selectedPipeline.id)
        .in('contact_id', verifiedIds);
      if (existErr) throw existErr;

      const existingSet = new Set((existing ?? []).map(r => r.contact_id));
      const toInsert = verifiedIds.filter(id => !existingSet.has(id));
      const skipped = verifiedIds.length - toInsert.length;

      if (toInsert.length === 0) {
        return { added: 0, skipped };
      }

      const inserts = toInsert.map((contactId, index) => ({
        contact_id: contactId,
        pipeline_id: selectedPipeline.id,
        stage_id: stage.id,
        stage_order: stage.stage_order + index,
        assigned_to_user_id: stage.default_assignee_user_id || null,
        source_type: 'manual',
      }));

      const { error } = await supabase.from('pipeline_contacts').insert(inserts);
      if (error) throw error;
      return { added: toInsert.length, skipped };
    },
    onSuccess: ({ added, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      // FlowContext refreshes on window events, not query invalidations
      window.dispatchEvent(new CustomEvent('flow-assignment-updated'));
      if (added > 0) {
        toast.success(
          `Added ${added} ${added === 1 ? 'person' : 'people'} to ${selectedPipeline?.name}${
            skipped > 0 ? ` (${skipped} already in flow)` : ''
          }`
        );
      } else {
        toast.info(`All selected people are already in ${selectedPipeline?.name}`);
      }
      handleClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error(error);
      toast.error('Could not add people to this Flow', { description: error?.message || 'Check that you are a Flow Owner or Contributor.' });
    },
  });

  const handleClose = () => {
    setStep(reviewFirst ? 'review' : 'pipeline');
    setSelectedPipeline(null);
    setSearch('');
    onOpenChange(false);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-2xl flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3">
            {(step === 'stage' || (step === 'pipeline' && reviewFirst)) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (step === 'stage') {
                    setStep('pipeline');
                    setSelectedPipeline(null);
                  } else {
                    setStep('review');
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === 'review'
                ? `Review ${contactIds.length} ${contactIds.length === 1 ? 'person' : 'people'}`
                : step === 'pipeline'
                ? `Add ${selectedIds.length} ${selectedIds.length === 1 ? 'person' : 'people'} to Flow`
                : `Select Step in ${selectedPipeline?.name}`}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === 'review' && (
          <>
            <p className="px-4 text-sm text-muted-foreground sm:px-6">
              Uncheck anyone who shouldn't be added. Nothing changes until you pick a Flow.
            </p>
            <div className="relative mx-4 sm:mx-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search these people..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-between px-4 text-sm sm:px-6">
              <span className="text-muted-foreground">{selectedIds.length} selected</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(contactIds)}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                  Select none
                </Button>
              </div>
            </div>
            <div className="mx-4 min-h-[180px] flex-1 divide-y overflow-y-auto rounded-md border sm:mx-6">
              {loadingPeople && (
                <p className="p-4 text-sm text-muted-foreground">Bringing up the people...</p>
              )}
              {!loadingPeople && filteredPeople.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No one matches that search.</p>
              )}
              {filteredPeople.map((p) => (
                <label key={p.id} className="flex min-h-12 items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{p.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {[p.campusName, p.email].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {step === 'pipeline' && (
          <FlowSelectionStep
            pipelines={pipelines || []}
            loading={loadingPipelines}
            onSelect={(p) => {
              setSelectedPipeline(p);
              setStep('stage');
            }}
          />
        )}

        {step === 'stage' && selectedPipeline && (
          <StageSelectionStep
            stages={stages || []}
            loading={loadingStages}
            adding={addMutation.isPending}
            onSelect={(s) => addMutation.mutate(s)}
          />
        )}

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step === 'review' && (
            <Button disabled={selectedIds.length === 0} onClick={() => setStep('pipeline')}>
              Continue with {selectedIds.length} {selectedIds.length === 1 ? 'person' : 'people'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
