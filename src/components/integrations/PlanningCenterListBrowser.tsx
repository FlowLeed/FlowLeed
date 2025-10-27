import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Calendar, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PlanningCenterList {
  id: string;
  attributes: {
    name: string;
    description?: string;
    total_people?: number;
    list_type?: string;
    updated_at?: string;
  };
}

interface PlanningCenterListBrowserProps {
  integrationId: string;
  onSelectList: (list: PlanningCenterList) => void;
  selectedListId?: string;
}

export function PlanningCenterListBrowser({ 
  integrationId, 
  onSelectList, 
  selectedListId 
}: PlanningCenterListBrowserProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get cached lists from database
  const { data: cachedLists, isLoading } = useQuery({
    queryKey: ['cached-lists', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_list_metadata')
        .select('external_list_id, name, description, member_count, list_type, last_updated_at')
        .eq('integration_id', integrationId)
        .order('name');
      
      if (error) throw error;
      
      // Transform to match expected format
      return data.map(item => ({
        id: item.external_list_id,
        attributes: {
          name: item.name,
          description: item.description,
          total_people: item.member_count,
          list_type: item.list_type,
          updated_at: item.last_updated_at,
        }
      })) as PlanningCenterList[];
    },
    enabled: !!integrationId,
  });

  // Mutation for refreshing lists
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('planning-center-lists', {
        body: {
          action: 'fetchLists',
          integrationId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cached-lists', integrationId] });
      toast({
        title: 'Lists refreshed',
        description: 'Planning Center lists have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to refresh lists. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading Planning Center lists...</span>
      </div>
    );
  }

  if (!cachedLists || cachedLists.length === 0) {
    return (
      <div className="text-center p-8">
        <List className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Lists Found</h3>
        <p className="text-muted-foreground mb-4">
          No Planning Center lists were found for this integration.
        </p>
        <Button onClick={handleRefresh} disabled={refreshMutation.isPending}>
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Refresh Lists
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select a Planning Center List</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {cachedLists.map((list) => (
          <Card
            key={list.id}
            className={`cursor-pointer transition-colors hover:bg-accent ${
              selectedListId === list.id ? 'bg-accent border-primary' : ''
            }`}
            onClick={() => onSelectList(list)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{list.attributes.name}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {list.attributes.list_type || 'Static'}
                </Badge>
              </div>
              {list.attributes.description && (
                <CardDescription className="text-sm">
                  {list.attributes.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{list.attributes.total_people || 0} people</span>
                </div>
                {list.attributes.updated_at && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Updated {new Date(list.attributes.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}