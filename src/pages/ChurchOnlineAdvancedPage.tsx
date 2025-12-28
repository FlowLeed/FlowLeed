import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Play, 
  Plus, 
  Trash2, 
  Heart, 
  HandHeart, 
  Users,
  Loader2
} from "lucide-react";

// Event types from Church Online Platform
const EVENT_TYPES = [
  { value: 'moment.interacted', label: 'Salvation Decision', icon: Heart, description: 'When someone indicates a salvation decision' },
  { value: 'prayer.requested', label: 'Prayer Request', icon: HandHeart, description: 'When someone submits a prayer request' },
  { value: 'service.attended', label: 'Service Attended', icon: Users, description: 'When someone attends an online service' },
  { value: 'user.created', label: 'New User', icon: Users, description: 'When a new user signs up' },
];

export default function ChurchOnlineAdvancedPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addingNew, setAddingNew] = useState(false);
  const [newAutomation, setNewAutomation] = useState({
    eventType: '',
    pipelineId: '',
    stageId: '',
    flowMomentTypeId: '',
    createContactIfMissing: true
  });

  // Fetch organization ID
  const { data: userOrgData } = useQuery({
    queryKey: ['user-organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      return data;
    }
  });

  // Fetch Church Online integration
  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ['church-online-integration', userOrgData?.organization_id],
    enabled: !!userOrgData?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('service_name', 'church_online')
        .eq('organization_id', userOrgData!.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch existing automations
  const { data: automations, isLoading: automationsLoading } = useQuery({
    queryKey: ['church-online-automations', integration?.id],
    enabled: !!integration?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('church_online_flow_automations')
        .select(`
          *,
          pipeline:pipelines(id, name),
          stage:pipeline_stages(id, name),
          flow_moment_type:flow_moment_types(id, name)
        `)
        .eq('integration_id', integration!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch pipelines for dropdown
  const { data: pipelines } = useQuery({
    queryKey: ['pipelines', userOrgData?.organization_id],
    enabled: !!userOrgData?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name')
        .eq('organization_id', userOrgData!.organization_id)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch stages for selected pipeline
  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages', newAutomation.pipelineId],
    enabled: !!newAutomation.pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name')
        .eq('pipeline_id', newAutomation.pipelineId)
        .order('stage_order');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch flow moment types
  const { data: momentTypes } = useQuery({
    queryKey: ['flow-moment-types', userOrgData?.organization_id],
    enabled: !!userOrgData?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_moment_types')
        .select('id, name')
        .eq('organization_id', userOrgData!.organization_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Create automation mutation
  const createAutomationMutation = useMutation({
    mutationFn: async () => {
      if (!integration || !userOrgData?.organization_id) {
        throw new Error('Missing integration or organization');
      }

      const { error } = await supabase
        .from('church_online_flow_automations')
        .insert({
          organization_id: userOrgData.organization_id,
          integration_id: integration.id,
          event_type: newAutomation.eventType,
          pipeline_id: newAutomation.pipelineId || null,
          stage_id: newAutomation.stageId || null,
          flow_moment_type_id: newAutomation.flowMomentTypeId || null,
          create_contact_if_missing: newAutomation.createContactIfMissing,
          event_filter: newAutomation.eventType === 'moment.interacted' 
            ? { momentType: 'SALVATION' } 
            : {}
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church-online-automations', integration?.id] });
      setAddingNew(false);
      setNewAutomation({
        eventType: '',
        pipelineId: '',
        stageId: '',
        flowMomentTypeId: '',
        createContactIfMissing: true
      });
      toast.success('Automation created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create automation', { description: error.message });
    }
  });

  // Delete automation mutation
  const deleteAutomationMutation = useMutation({
    mutationFn: async (automationId: string) => {
      const { error } = await supabase
        .from('church_online_flow_automations')
        .delete()
        .eq('id', automationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church-online-automations', integration?.id] });
      toast.success('Automation deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete automation', { description: error.message });
    }
  });

  // Toggle automation active state
  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('church_online_flow_automations')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church-online-automations', integration?.id] });
    }
  });

  const getEventTypeInfo = (eventType: string) => {
    return EVENT_TYPES.find(et => et.value === eventType) || { label: eventType, icon: Play };
  };

  if (integrationLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="flex flex-col h-full">
        <Header 
          title="Church Online Settings" 
          showFlowIcon={false}
          showAddButton={false}
        />
        <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Church Online Platform is not connected yet.</p>
              <Button onClick={() => navigate('/integrations')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Integrations
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Church Online Settings" 
        showFlowIcon={false}
        showAddButton={false}
      />
      
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/integrations">Integrations</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Church Online Platform</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Event Automations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Event Automations</CardTitle>
                <CardDescription>
                  Configure what happens when Church Online sends webhook events
                </CardDescription>
              </div>
              <Button onClick={() => setAddingNew(true)} disabled={addingNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Automation
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new automation form */}
            {addingNew && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h4 className="font-medium">New Automation</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>When this event occurs</Label>
                    <Select 
                      value={newAutomation.eventType}
                      onValueChange={(v) => setNewAutomation(prev => ({ ...prev, eventType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(et => (
                          <SelectItem key={et.value} value={et.value}>
                            {et.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Add to Flow (optional)</Label>
                    <Select 
                      value={newAutomation.pipelineId}
                      onValueChange={(v) => setNewAutomation(prev => ({ 
                        ...prev, 
                        pipelineId: v,
                        stageId: '' // Reset stage when pipeline changes
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select flow" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines?.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {newAutomation.pipelineId && (
                    <div className="space-y-2">
                      <Label>Starting Stage</Label>
                      <Select 
                        value={newAutomation.stageId}
                        onValueChange={(v) => setNewAutomation(prev => ({ ...prev, stageId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {stages?.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Log as Flow Moment (optional)</Label>
                    <Select 
                      value={newAutomation.flowMomentTypeId}
                      onValueChange={(v) => setNewAutomation(prev => ({ ...prev, flowMomentTypeId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select moment type" />
                      </SelectTrigger>
                      <SelectContent>
                        {momentTypes?.map(mt => (
                          <SelectItem key={mt.id} value={mt.id}>{mt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={newAutomation.createContactIfMissing}
                    onCheckedChange={(checked) => setNewAutomation(prev => ({ 
                      ...prev, 
                      createContactIfMissing: checked 
                    }))}
                  />
                  <Label>Create contact if not found</Label>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => createAutomationMutation.mutate()}
                    disabled={!newAutomation.eventType || createAutomationMutation.isPending}
                  >
                    {createAutomationMutation.isPending ? 'Creating...' : 'Create Automation'}
                  </Button>
                  <Button variant="outline" onClick={() => setAddingNew(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Existing automations list */}
            {automationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : automations?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No automations configured yet.</p>
                <p className="text-sm">Add an automation to route Church Online events to your flows.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {automations?.map((automation) => {
                  const eventInfo = getEventTypeInfo(automation.event_type);
                  const Icon = eventInfo.icon;
                  
                  return (
                    <div 
                      key={automation.id} 
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        automation.is_active ? '' : 'opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{eventInfo.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {automation.pipeline?.name && (
                              <>→ {automation.pipeline.name}</>
                            )}
                            {automation.stage?.name && (
                              <> / {automation.stage.name}</>
                            )}
                            {automation.flow_moment_type?.name && (
                              <> (logs as {automation.flow_moment_type.name})</>
                            )}
                            {!automation.pipeline && !automation.flow_moment_type && (
                              <>No action configured</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={automation.is_active}
                          onCheckedChange={(checked) => 
                            toggleAutomationMutation.mutate({ id: automation.id, isActive: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAutomationMutation.mutate(automation.id)}
                          disabled={deleteAutomationMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back button */}
        <Button variant="outline" onClick={() => navigate('/integrations')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Integrations
        </Button>
      </div>
    </div>
  );
}
