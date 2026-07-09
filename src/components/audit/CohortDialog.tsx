import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Users, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Finding } from './SectionCard';

interface CohortDialogProps {
  finding: Finding | null;
  organizationId: string;
  onClose: () => void;
}

interface ContactRow { id: string; name: string; avatar: string | null; }
interface FlowRow { id: string; name: string; }
interface StageRow { id: string; pipeline_id: string; name: string; stage_order: number; }

export const CohortDialog = ({ finding, organizationId, onClose }: CohortDialogProps) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedFlow, setSelectedFlow] = useState<string>('');
  const [newFlowName, setNewFlowName] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const open = !!finding;

  useEffect(() => {
    if (!finding) return;
    setLoadingContacts(true);
    setMode('existing');
    setNewFlowName(`Follow-up: ${finding.title}`);

    (async () => {
      // Contacts
      if (finding.contact_ids.length > 0) {
        const { data } = await supabase
          .from('contacts')
          .select('id, name, avatar')
          .in('id', finding.contact_ids)
          .limit(500);
        setContacts(data || []);
      } else {
        setContacts([]);
      }
      setLoadingContacts(false);

      // Flows in org
      const [flowsRes, stagesRes] = await Promise.all([
        supabase.from('pipelines').select('id, name').eq('organization_id', organizationId).order('name'),
        supabase.from('pipeline_stages').select('id, pipeline_id, name, stage_order').order('stage_order'),
      ]);
      setFlows((flowsRes.data as FlowRow[]) || []);
      setStages((stagesRes.data as StageRow[]) || []);
    })();
  }, [finding, organizationId]);

  const firstStageFor = (pipelineId: string) => {
    return stages.filter((s) => s.pipeline_id === pipelineId).sort((a, b) => a.stage_order - b.stage_order)[0];
  };

  const handleEnroll = async () => {
    if (!finding || contacts.length === 0) return;
    setEnrolling(true);
    try {
      let pipelineId = selectedFlow;
      let stageId: string | undefined;

      if (mode === 'new') {
        if (!newFlowName.trim()) { toast.error('Flow name required'); setEnrolling(false); return; }
        // Create new flow
        const { data: newFlow, error: fErr } = await supabase
          .from('pipelines')
          .insert({
            name: newFlowName.trim(),
            organization_id: organizationId,
            created_by_user_id: user?.id,
            type: 'custom',
          } as any)
          .select('id')
          .single();
        if (fErr || !newFlow) throw fErr || new Error('Failed to create flow');
        pipelineId = newFlow.id;

        // Create a default first stage
        const { data: newStage, error: sErr } = await supabase
          .from('pipeline_stages')
          .insert({
            pipeline_id: pipelineId,
            name: 'To Reach',
            stage_order: 0,
            organization_id: organizationId,
          } as any)
          .select('id')
          .single();
        if (sErr || !newStage) throw sErr || new Error('Failed to create stage');
        stageId = newStage.id;
      } else {
        if (!pipelineId) { toast.error('Pick a flow'); setEnrolling(false); return; }
        const s = firstStageFor(pipelineId);
        if (!s) { toast.error('Flow has no stages'); setEnrolling(false); return; }
        stageId = s.id;
      }

      // Dedup then insert
      const { data: existing } = await supabase
        .from('pipeline_contacts')
        .select('contact_id')
        .eq('pipeline_id', pipelineId)
        .in('contact_id', finding.contact_ids);
      const existingSet = new Set((existing || []).map((r: any) => r.contact_id));
      const toInsert = finding.contact_ids.filter((id) => !existingSet.has(id));

      if (toInsert.length > 0) {
        const rows = toInsert.map((cid, i) => ({
          contact_id: cid,
          pipeline_id: pipelineId,
          stage_id: stageId!,
          stage_order: i,
          source_type: 'manual',
        }));
        const { error: iErr } = await supabase.from('pipeline_contacts').insert(rows as any);
        if (iErr) throw iErr;
      }

      toast.success(
        `Added ${toInsert.length} ${toInsert.length === 1 ? 'person' : 'people'} to the flow${
          finding.contact_ids.length - toInsert.length > 0 ? ` (${finding.contact_ids.length - toInsert.length} already enrolled)` : ''
        }`,
      );
      onClose();
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{finding?.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {finding?.description}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid md:grid-cols-2 gap-4 min-h-0">
          {/* Contact list */}
          <div className="border rounded-lg flex flex-col min-h-0">
            <div className="p-3 border-b bg-muted/30 flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              {contacts.length} {contacts.length === 1 ? 'person' : 'people'}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingContacts ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
              ) : contacts.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">No people to show.</div>
              ) : (
                <ul className="divide-y">
                  {contacts.map((c) => (
                    <li key={c.id} className="p-3 flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarImage src={c.avatar || undefined} /><AvatarFallback>{(c.name || '?').charAt(0)}</AvatarFallback></Avatar>
                      <span className="text-sm truncate">{c.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Enroll picker */}
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Add these people to a Flow</div>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="r-existing" />
                  <Label htmlFor="r-existing" className="cursor-pointer">Existing flow</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="r-new" />
                  <Label htmlFor="r-new" className="cursor-pointer">Create new flow</Label>
                </div>
              </RadioGroup>
            </div>

            {mode === 'existing' ? (
              <div className="space-y-2">
                <Label>Flow</Label>
                <Select value={selectedFlow} onValueChange={setSelectedFlow}>
                  <SelectTrigger><SelectValue placeholder="Pick a flow…" /></SelectTrigger>
                  <SelectContent>
                    {flows.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>New flow name</Label>
                <Input value={newFlowName} onChange={(e) => setNewFlowName(e.target.value)} placeholder="e.g. Reconnect: Drifting" />
                <p className="text-xs text-muted-foreground">A "To Reach" starting stage will be created for you.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleEnroll} disabled={enrolling || contacts.length === 0}>
            {enrolling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding…</> : <><Plus className="h-4 w-4 mr-2" />Add {contacts.length} to Flow</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
