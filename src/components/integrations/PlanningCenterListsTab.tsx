import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIntegrations } from '@/hooks/useIntegrations';
import { usePipelineContext } from '@/contexts/PipelineContext';
import { Loader2, List, ArrowRight, Trash2, Users, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PlanningCenterListsTab = () => {
  const { toast } = useToast();
  const { 
    lists, 
    mappings, 
    loading, 
    getLists, 
    mapListToFlow, 
    unmapList, 
    syncLists, 
    isConnected 
  } = useIntegrations();
  const { pipelines } = usePipelineContext();
  
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedList, setSelectedList] = useState<string>('');

  const selectedPipelineData = Object.values(pipelines).find(p => p.id === selectedPipeline);
  const availableStages = selectedPipelineData?.stages || [];

  useEffect(() => {
    if (isConnected('planning_center')) {
      getLists();
    }
  }, []);

  const handleMapList = async () => {
    if (!selectedList || !selectedPipeline || !selectedStage) {
      toast({
        title: "Error",
        description: "Please select a list, pipeline, and stage",
        variant: "destructive",
      });
      return;
    }

    const list = lists.find(l => l.id === selectedList);
    if (!list) return;

    await mapListToFlow(selectedList, list.attributes.name, selectedPipeline, selectedStage);
    
    // Reset form
    setSelectedList('');
    setSelectedPipeline('');
    setSelectedStage('');
  };

  const getListMapping = (listId: string) => {
    return mappings.find(m => m.external_list_id === listId);
  };

  if (!isConnected('planning_center')) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Planning Center Not Connected</h3>
          <p className="text-muted-foreground">
            Connect your Planning Center account to manage list mappings
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* List Mapping Form */}
      <Card>
        <CardHeader>
          <CardTitle>Map Lists to Flows</CardTitle>
          <CardDescription>
            Automatically add people from Planning Center lists to specific pipeline stages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Planning Center List</label>
              <Select value={selectedList} onValueChange={setSelectedList}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists
                    .filter(list => !getListMapping(list.id)) // Only show unmapped lists
                    .map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.attributes.name} ({list.attributes.total_people} people)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Pipeline</label>
              <Select value={selectedPipeline} onValueChange={(value) => {
                setSelectedPipeline(value);
                setSelectedStage(''); // Reset stage when pipeline changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(pipelines).map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Stage</label>
              <Select value={selectedStage} onValueChange={setSelectedStage} disabled={!selectedPipeline}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleMapList}
              disabled={loading || !selectedList || !selectedPipeline || !selectedStage}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Map List to Flow
            </Button>
            
            <Button 
              variant="outline" 
              onClick={syncLists}
              disabled={loading || mappings.length === 0}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync All Lists
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Current List Mappings</CardTitle>
          <CardDescription>
            Active mappings between Planning Center lists and your pipelines
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No List Mappings</h3>
              <p className="text-muted-foreground">
                Map Planning Center lists to your pipelines to automatically sync people
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <List className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{mapping.external_list_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {mapping.pipelines.name} → {mapping.pipeline_stages.name}
                      </p>
                      {mapping.last_sync_at && (
                        <p className="text-xs text-muted-foreground">
                          Last sync: {new Date(mapping.last_sync_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={mapping.auto_sync ? "default" : "secondary"}>
                      {mapping.auto_sync ? "Auto Sync" : "Manual"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unmapList(mapping.external_list_id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Lists */}
      {lists.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Lists</CardTitle>
            <CardDescription>
              All lists from your Planning Center account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {lists.map((list) => {
                const mapping = getListMapping(list.id);
                return (
                  <div
                    key={list.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <h4 className="font-medium">{list.attributes.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {list.attributes.total_people} people
                        {list.attributes.description && ` • ${list.attributes.description}`}
                      </p>
                    </div>
                    
                    {mapping ? (
                      <Badge variant="default">
                        Mapped to {mapping.pipelines.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        Not Mapped
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlanningCenterListsTab;