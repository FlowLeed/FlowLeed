import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Clock, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSyncCheckins } from "@/hooks/useCheckinData";

interface SyncSettingsSectionProps {
  integrationId: string;
  currentFrequency: string;
  lastSyncAt?: string;
  autoSyncAllEnabled?: boolean;
  onSyncNow: () => void;
  isSyncing?: boolean;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Once a day' },
  { value: 'twice_daily', label: 'Twice a day' },
  { value: 'manual', label: 'Manual only' },
];

export function SyncSettingsSection({ 
  integrationId, 
  currentFrequency, 
  lastSyncAt, 
  autoSyncAllEnabled = true,
  onSyncNow, 
  isSyncing 
}: SyncSettingsSectionProps) {
  const [selectedFrequency, setSelectedFrequency] = useState(currentFrequency);
  const [autoSyncAll, setAutoSyncAll] = useState(autoSyncAllEnabled);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const syncCheckins = useSyncCheckins();

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

  const updateAutoSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('integrations')
        .update({ auto_sync_all_people: enabled })
        .eq('id', integrationId);
      
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: enabled ? "Automatic sync enabled" : "Automatic sync disabled",
        description: enabled 
          ? "All Planning Center contacts will sync automatically based on your frequency setting."
          : "Contacts will only sync when you click 'Sync All People'.",
      });
    },
    onError: (error) => {
      // Revert UI state on error
      setAutoSyncAll(!autoSyncAll);
      toast({
        title: "Error updating auto-sync setting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFrequencyChange = (frequency: string) => {
    setSelectedFrequency(frequency);
    updateFrequencyMutation.mutate(frequency);
  };

  const handleAutoSyncToggle = (checked: boolean) => {
    setAutoSyncAll(checked);
    updateAutoSyncMutation.mutate(checked);
  };

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
          {isSyncing ? 'Syncing...' : 'Sync All People'}
        </Button>
        <Button
          onClick={() => syncCheckins.mutate(integrationId)}
          disabled={syncCheckins.isPending}
          size="sm"
          variant="outline"
          className="shrink-0"
        >
          <CheckSquare className={`h-4 w-4 mr-2 ${syncCheckins.isPending ? 'animate-spin' : ''}`} />
          {syncCheckins.isPending ? 'Syncing...' : 'Sync Check-Ins'}
        </Button>
      </div>

      <div className="flex items-center justify-between py-3 border-b">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">Automatic Sync</label>
          <p className="text-xs text-muted-foreground">
            Keep all contacts up-to-date automatically
          </p>
        </div>
        <Switch
          checked={autoSyncAll}
          onCheckedChange={handleAutoSyncToggle}
          disabled={updateAutoSyncMutation.isPending}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Sync Frequency</label>
        <Select 
          value={selectedFrequency} 
          onValueChange={handleFrequencyChange}
          disabled={!autoSyncAll}
        >
          <SelectTrigger className={!autoSyncAll ? "opacity-50" : ""}>
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
        {!autoSyncAll && (
          <p className="text-xs text-muted-foreground">
            Enable automatic sync to set a frequency
          </p>
        )}
      </div>
    </div>
  );
}