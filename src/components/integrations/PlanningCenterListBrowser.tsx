import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Calendar, List, Link2, AlertTriangle, RefreshCw } from 'lucide-react';

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

type FetchResult =
  | { kind: 'ok'; lists: PlanningCenterList[] }
  | { kind: 'not_connected' }
  | { kind: 'reauth_required' };

export function PlanningCenterListBrowser({
  integrationId,
  onSelectList,
  selectedListId,
}: PlanningCenterListBrowserProps) {
  const navigate = useNavigate();

  const { data, isLoading, isFetching, refetch, error } = useQuery<FetchResult>({
    queryKey: ['pco-user-lists', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('planning-center-lists', {
        body: { action: 'fetchLists', integrationId },
      });
      if (error) throw error;
      if (data?.error === 'USER_PCO_NOT_CONNECTED') return { kind: 'not_connected' };
      if (data?.error === 'USER_PCO_REAUTH_REQUIRED') return { kind: 'reauth_required' };
      const lists: PlanningCenterList[] = (data?.lists ?? []).map((l: any) => ({
        id: l.id,
        attributes: {
          name: l.attributes?.name,
          description: l.attributes?.description,
          total_people: l.attributes?.total_people,
          list_type: l.attributes?.list_type,
          updated_at: l.attributes?.updated_at,
        },
      }));
      return { kind: 'ok', lists };
    },
    enabled: !!integrationId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading your Planning Center lists...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-sm text-destructive mb-4">Failed to load lists. Please try again.</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (data?.kind === 'not_connected' || data?.kind === 'reauth_required') {
    const isReauth = data.kind === 'reauth_required';
    return (
      <div className="text-center p-8 border border-dashed rounded-lg">
        <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-3">
          {isReauth ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <Link2 className="h-5 w-5 text-primary" />
          )}
        </div>
        <h3 className="text-base font-semibold mb-1">
          {isReauth ? 'Reconnect your Planning Center account' : 'Connect your Planning Center account'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          FlowLeed shows only the lists your own PCO account can see.
        </p>
        <Button onClick={() => navigate('/profile')}>
          {isReauth ? 'Reconnect' : 'Connect Planning Center'}
        </Button>
      </div>
    );
  }

  const lists = data?.kind === 'ok' ? data.lists : [];

  if (lists.length === 0) {
    return (
      <div className="text-center p-8">
        <List className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Lists Found</h3>
        <p className="text-muted-foreground mb-4">
          Your Planning Center account doesn't have any visible lists.
        </p>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select a Planning Center List</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {lists.map((list) => (
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
