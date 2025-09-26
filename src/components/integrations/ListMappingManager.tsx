import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  Users,
  ArrowRight 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ListMapping {
  id: string;
  external_list_id: string;
  external_list_name: string;
  pipeline_id: string;
  stage_id: string;
  auto_sync: boolean;
  last_sync_at: string | null;
  created_at: string;
  pipelines: {
    name: string;
    icon?: string;
  };
  pipeline_stages: {
    name: string;
    color?: string;
  };
}

interface ListMappingManagerProps {
  integrationId: string;
  onCreateMapping: () => void;
}

export function ListMappingManager({ integrationId, onCreateMapping }: ListMappingManagerProps) {
  const [syncingMappings, setSyncingMappings] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['integration-list-mappings', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_list_mappings')
        .select(`
          *,
          pipelines(name, icon),
          pipeline_stages(name, color)
        `)
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ListMapping[];
    },
    enabled: !!integrationId,
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from('integration_list_mappings')
        .delete()
        .eq('id', mappingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-list-mappings'] });
      toast({
        title: 'Mapping deleted',
        description: 'The list mapping has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete mapping. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSyncMapping = async (mapping: ListMapping) => {
    setSyncingMappings(prev => new Set(prev).add(mapping.id));
    
    try {
      const { data, error } = await supabase.functions.invoke('planning-center-lists', {
        body: {
          action: 'syncLists',
          listMappings: [mapping],
        },
      });

      if (error) throw error;

      const result = data.results[0];
      if (result.success) {
        // Update last sync time
        await supabase
          .from('integration_list_mappings')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', mapping.id);

        queryClient.invalidateQueries({ queryKey: ['integration-list-mappings'] });
        
        // Dispatch event to refresh flow data
        window.dispatchEvent(new CustomEvent('pco-sync-complete'));
        
        toast({
          title: 'Sync completed',
          description: `Added ${result.contactsAdded} new contacts, updated ${result.contactsUpdated} existing contacts.`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync failed',
        description: 'Failed to sync list. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSyncingMappings(prev => {
        const newSet = new Set(prev);
        newSet.delete(mapping.id);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading mappings...</span>
      </div>
    );
  }

  if (!mappings || mappings.length === 0) {
    return (
      <div className="text-center p-8">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No List Mappings</h3>
        <p className="text-muted-foreground mb-4">
          Create your first mapping to sync Planning Center lists with your CRM pipelines.
        </p>
        <Button onClick={onCreateMapping}>
          Create First Mapping
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">List Mappings</h3>
        <Button onClick={onCreateMapping} variant="outline">
          Quick Map Another List
        </Button>
      </div>

      <div className="grid gap-4">
        {mappings.map((mapping) => (
          <Card key={mapping.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  {mapping.external_list_name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {mapping.auto_sync && (
                    <Badge variant="secondary" className="text-xs">
                      Auto Sync
                    </Badge>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Mapping</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this mapping? This action cannot be undone.
                          Existing contacts will remain in the pipeline.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMappingMutation.mutate(mapping.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{mapping.pipelines.name}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{mapping.pipeline_stages.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSyncMapping(mapping)}
                  disabled={syncingMappings.has(mapping.id)}
                >
                  {syncingMappings.has(mapping.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
              </div>
              {mapping.last_sync_at && (
                <div className="text-xs text-muted-foreground mt-2">
                  Last synced: {new Date(mapping.last_sync_at).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}