import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface SyncSettingsSectionProps {
  integrationId: string;
  currentFrequency: string;
  lastSyncAt?: string;
  onSyncNow: () => void;
  isSyncing?: boolean;
}

const FREQUENCY_OPTIONS = [
  { value: 'every_5_minutes', label: 'Every 5 minutes' },
  { value: 'every_15_minutes', label: 'Every 15 minutes' },
  { value: 'every_30_minutes', label: 'Every 30 minutes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'manual', label: 'Manual only' },
];

const getNextSyncTime = (lastSync: string | undefined, frequency: string): string | null => {
  if (!lastSync || frequency === 'manual') return null;
  
  const lastSyncDate = new Date(lastSync);
  let nextSync: Date;
  
  switch (frequency) {
    case 'every_5_minutes':
      nextSync = new Date(lastSyncDate.getTime() + 5 * 60 * 1000);
      break;
    case 'every_15_minutes':
      nextSync = new Date(lastSyncDate.getTime() + 15 * 60 * 1000);
      break;
    case 'every_30_minutes':
      nextSync = new Date(lastSyncDate.getTime() + 30 * 60 * 1000);
      break;
    case 'hourly':
      nextSync = new Date(lastSyncDate.getTime() + 60 * 60 * 1000);
      break;
    case 'daily':
      nextSync = new Date(lastSyncDate.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      nextSync = new Date(lastSyncDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      return null;
  }
  
  return `in ${formatDistanceToNow(nextSync)}`;
};

export function SyncSettingsSection({ 
  integrationId, 
  currentFrequency, 
  lastSyncAt, 
  onSyncNow, 
  isSyncing 
}: SyncSettingsSectionProps) {
  const [selectedFrequency, setSelectedFrequency] = useState(currentFrequency);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateFrequencyMutation = useMutation({
    mutationFn: async (frequency: string) => {
      const { error } = await supabase
        .from('integrations')
        .update({ sync_frequency: frequency })
        .eq('id', integrationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: "Sync frequency updated",
        description: "Your sync settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating sync frequency",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFrequencyChange = (frequency: string) => {
    setSelectedFrequency(frequency);
    updateFrequencyMutation.mutate(frequency);
  };

  const currentFrequencyLabel = FREQUENCY_OPTIONS.find(
    opt => opt.value === currentFrequency
  )?.label || 'Every 15 minutes';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h3 className="font-medium">Sync Settings</h3>
        </div>
        <Button 
          onClick={onSyncNow} 
          disabled={isSyncing}
          size="sm"
          variant="outline"
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync All Mappings'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Sync Frequency</label>
          <Select value={selectedFrequency} onValueChange={handleFrequencyChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Sync Status</label>
          <div className="text-sm text-muted-foreground space-y-1 pt-2">
            {lastSyncAt && (
              <div>Last sync: {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}</div>
            )}
            {getNextSyncTime(lastSyncAt, currentFrequency) && (
              <div>Next sync: {getNextSyncTime(lastSyncAt, currentFrequency)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}