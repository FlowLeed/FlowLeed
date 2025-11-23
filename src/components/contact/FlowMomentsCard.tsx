import { useFlowMoments } from "@/hooks/useFlowMoments";
import { useFlowMomentTypes } from "@/hooks/useFlowMomentTypes";
import { usePcoMomentMappings } from "@/hooks/usePcoMomentMappings";
import { Loader2, Sparkles } from "lucide-react";
import { iconMap } from "@/lib/flowIcons";
import { format } from "date-fns";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FlowMomentsCardProps {
  contactId: string;
}

interface MomentBadgeProps {
  moment: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    isCompleted: boolean;
    occurredAt?: string;
  };
}

function MomentBadge({ moment }: MomentBadgeProps) {
  const IconComponent = moment.icon 
    ? iconMap[moment.icon] || Sparkles
    : Sparkles;

  const isCompleted = moment.isCompleted;
  
  return (
    <div className="flex flex-col items-center gap-2 min-w-[100px]">
      {/* Circular icon badge */}
      <div 
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center transition-all",
          !isCompleted && "opacity-50"
        )}
        style={{ 
          backgroundColor: isCompleted && moment.color
            ? `${moment.color}20` 
            : 'hsl(var(--muted))',
        }}
      >
        <IconComponent 
          className="h-7 w-7" 
          style={{ 
            color: isCompleted && moment.color
              ? moment.color 
              : 'hsl(var(--muted-foreground))',
          }}
        />
      </div>
      
      {/* Moment name */}
      <p 
        className={cn(
          "text-sm font-medium text-center leading-tight max-w-[100px]",
          !isCompleted && "text-muted-foreground"
        )}
      >
        {moment.name}
      </p>
      
      {/* Date or status */}
      {isCompleted && moment.occurredAt && (
        <p 
          className="text-xs text-center font-medium"
          style={{
            color: moment.color || undefined
          }}
        >
          {format(new Date(moment.occurredAt), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  );
}

export function FlowMomentsCard({ contactId }: FlowMomentsCardProps) {
  const { data: moments, isLoading: momentsLoading } = useFlowMoments(contactId);
  const { momentTypes, isLoading: typesLoading } = useFlowMomentTypes();

  // Get contact's organization
  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('organization_id')
        .eq('id', contactId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  // Get PCO integration
  const { data: integration } = useQuery({
    queryKey: ['pco-integration', contact?.organization_id],
    queryFn: async () => {
      if (!contact?.organization_id) return null;
      const { data, error } = await supabase
        .from('integrations')
        .select('id')
        .eq('organization_id', contact.organization_id)
        .eq('service_name', 'planning_center')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!contact?.organization_id,
  });

  // Get PCO moment mappings
  const { mappings, isLoading: mappingsLoading } = usePcoMomentMappings(integration?.id);

  const isLoading = momentsLoading || typesLoading || mappingsLoading;

  const mergedMoments = useMemo(() => {
    if (!momentTypes) return [];
    
    // Get the set of moment type IDs that have active mappings
    const mappedMomentTypeIds = new Set(
      mappings
        ?.filter(m => m.is_active)
        ?.map(m => m.flow_moment_type_id) || []
    );
    
    // Filter to only show moment types that have mappings
    const filteredTypes = momentTypes.filter(type => 
      mappedMomentTypeIds.has(type.id)
    );
    
    return filteredTypes.map(type => {
      // Find if this contact has completed this moment
      const completedMoment = moments?.find(
        m => m.flow_moment_type_id === type.id
      );
      
      return {
        id: type.id,
        name: type.name,
        icon: type.icon,
        color: type.color,
        isCompleted: !!completedMoment,
        occurredAt: completedMoment?.occurred_at,
      };
    }).sort((a, b) => {
      // Sort completed moments first
      if (a.isCompleted && !b.isCompleted) return -1;
      if (!a.isCompleted && b.isCompleted) return 1;
      return 0;
    });
  }, [momentTypes, moments, mappings]);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Sparkles className="h-5 w-5" />
        Flow Moments
      </h3>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : mergedMoments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No moment types mapped to PCO fields
        </p>
      ) : (
        <div className="flex overflow-x-auto gap-6 pb-4 px-1">
          {mergedMoments.map((moment) => (
            <MomentBadge key={moment.id} moment={moment} />
          ))}
        </div>
      )}
    </div>
  );
}
