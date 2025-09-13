import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, HelpCircle, Zap, Users, Target } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface QuickMappingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
}

interface CachedList {
  external_list_id: string;
  name: string;
  description?: string;
  member_count?: number;
  list_type?: string;
}

interface Flow {
  id: string;
  name: string;
  icon?: string;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
  stage_order: number;
}

export function QuickMappingDialog({
  isOpen,
  onOpenChange,
  integrationId,
}: QuickMappingDialogProps) {
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-refresh lists when modal opens
  useEffect(() => {
    if (isOpen && integrationId) {
      refreshListsMutation.mutate();
    }
  }, [isOpen, integrationId]);

  // Fetch cached lists from database
  const { data: cachedLists, isLoading: listsLoading } = useQuery({
    queryKey: ['cached-lists', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_list_metadata')
        .select('external_list_id, name, description, member_count, list_type')
        .eq('integration_id', integrationId)
        .order('name');
      
      if (error) throw error;
      
      // Deduplicate by external_list_id to prevent duplicate entries
      const uniqueLists = data?.reduce((acc: CachedList[], current) => {
        const exists = acc.find(item => item.external_list_id === current.external_list_id);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []) || [];
      
      return uniqueLists as CachedList[];
    },
    enabled: isOpen && !!integrationId,
  });

  // Fetch flows
  const { data: flows, isLoading: flowsLoading } = useQuery({
    queryKey: ['flows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, icon')
        .order('name');
      
      if (error) throw error;
      return data as Flow[];
    },
    enabled: isOpen,
  });

  // Fetch stages for selected flow
  const { data: stages, isLoading: stagesLoading } = useQuery({
    queryKey: ['flow-stages', selectedFlowId],
    queryFn: async () => {
      if (!selectedFlowId) return [];
      
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, stage_order')
        .eq('pipeline_id', selectedFlowId)
        .order('stage_order');
      
      if (error) throw error;
      return data as Stage[];
    },
    enabled: !!selectedFlowId,
  });

  const createMappingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListId || !selectedFlowId || !selectedStageId) {
        throw new Error('Please select a list, flow, and stage');
      }

      const selectedList = cachedLists?.find(l => l.external_list_id === selectedListId);
      if (!selectedList) {
        throw new Error('Selected list not found');
      }

      const { error } = await supabase
        .from('integration_list_mappings')
        .insert({
          integration_id: integrationId,
          pipeline_id: selectedFlowId,
          stage_id: selectedStageId,
          external_list_id: selectedListId,
          external_list_name: selectedList.name,
          auto_sync: true, // Smart default - auto-enable sync
        });

      if (error) throw error;

      return selectedList;
    },
    onSuccess: async (selectedList) => {
      queryClient.invalidateQueries({ queryKey: ['integration-list-mappings'] });
      
      toast({
        title: 'Mapping created successfully',
        description: `"${selectedList.name}" is now mapped and will sync automatically every 15 minutes.`,
      });
      
      // Automatically trigger initial sync
      try {
        const newMapping = {
          integration_id: integrationId,
          pipeline_id: selectedFlowId,
          stage_id: selectedStageId,
          external_list_id: selectedListId,
          external_list_name: selectedList.name,
        };
        
        const { data: syncData, error: syncError } = await supabase.functions.invoke('planning-center-lists', {
          body: {
            action: 'syncLists',
            listMappings: [newMapping],
          },
        });

        if (!syncError && syncData?.results?.[0]?.success) {
          const result = syncData.results[0];
          toast({
            title: 'Initial sync completed',
            description: `Added ${result.contactsAdded} new contacts, updated ${result.contactsUpdated} existing contacts.`,
          });
        }
      } catch (syncError) {
        console.warn('Auto-sync failed:', syncError);
        // Don't show error toast as the mapping was successful
      }
      
      handleClose();
    },
    onError: (error) => {
      toast({
        title: 'Failed to create mapping',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const refreshListsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('planning-center-lists', {
        body: {
          action: 'fetchLists',
          integrationId: integrationId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cached-lists', integrationId] });
      toast({
        title: 'Lists refreshed',
        description: 'Planning Center lists have been updated with the latest data.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to refresh lists',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setSelectedListId('');
    setSelectedFlowId('');
    setSelectedStageId('');
    onOpenChange(false);
  };

  const handleFlowChange = (flowId: string) => {
    setSelectedFlowId(flowId);
    setSelectedStageId(''); // Reset stage when flow changes
  };

  const isValid = selectedListId && selectedFlowId && selectedStageId;

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick List Mapping
            </DialogTitle>
            <DialogDescription>
              Map a Planning Center list to a flow stage in one step. Auto-sync is enabled by default.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Planning Center List Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Planning Center List
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Choose which Planning Center list you want to sync. People from this list will be automatically added to your selected flow stage.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <Select value={selectedListId} onValueChange={setSelectedListId} disabled={listsLoading || refreshListsMutation.isPending}>
                <SelectTrigger>
                  <SelectValue 
                    placeholder={
                      listsLoading || refreshListsMutation.isPending 
                        ? "Loading latest lists..." 
                        : "Select a Planning Center list"
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {cachedLists?.map((list) => (
                    <SelectItem key={list.external_list_id} value={list.external_list_id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{list.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {list.member_count} people • {list.list_type || 'Static'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {(listsLoading || refreshListsMutation.isPending) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {refreshListsMutation.isPending ? 'Syncing latest lists from Planning Center...' : 'Loading cached lists...'}
                </div>
              )}
              
              {!listsLoading && !refreshListsMutation.isPending && cachedLists?.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No lists found. Please check your Planning Center integration.
                </div>
              )}
            </div>

            {/* Flow Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Target Flow
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Select which flow you want to add people to. This helps organize your contacts by their spiritual journey stage.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <Select value={selectedFlowId} onValueChange={handleFlowChange} disabled={flowsLoading}>
                <SelectTrigger>
                  <SelectValue 
                    placeholder={flowsLoading ? "Loading flows..." : "Select target flow"} 
                  />
                </SelectTrigger>
                <SelectContent>
                  {flows?.map((flow) => (
                    <SelectItem key={flow.id} value={flow.id}>
                      <div className="flex items-center gap-2">
                        {flow.icon && <span>{flow.icon}</span>}
                        <span>{flow.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stage Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Stage in Flow</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Choose the specific stage where contacts from this list should be placed. This represents their current step in the spiritual journey.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <Select 
                value={selectedStageId} 
                onValueChange={setSelectedStageId} 
                disabled={!selectedFlowId || stagesLoading}
              >
                <SelectTrigger>
                  <SelectValue 
                    placeholder={
                      !selectedFlowId 
                        ? "Select a flow first" 
                        : stagesLoading 
                        ? "Loading stages..." 
                        : "Select target stage"
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {stages?.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        {stage.color && (
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: stage.color }}
                          />
                        )}
                        <span>{stage.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Smart Defaults Info */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Smart Defaults Applied
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Auto-sync enabled - contacts will sync automatically</li>
                <li>• Sync frequency: Every 15 minutes (can be changed later)</li>
                <li>• Initial sync will run immediately after mapping</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMappingMutation.mutate()} 
              disabled={!isValid || createMappingMutation.isPending}
            >
              {createMappingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Mapping...
                </>
              ) : (
                'Create Mapping & Start Sync'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}