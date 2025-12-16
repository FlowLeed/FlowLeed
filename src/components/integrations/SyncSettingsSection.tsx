import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncSettingsSectionProps {
  integrationId: string;
  currentFrequency: string;
  lastSyncAt?: string;
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
  )?.label || 'Once a day';

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
      </div>

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
    </div>
  );
}