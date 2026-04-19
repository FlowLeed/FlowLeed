import { useFlowMoments } from "@/hooks/useFlowMoments";
import { useFlowMomentTypes } from "@/hooks/useFlowMomentTypes";
import { usePcoMomentMappings } from "@/hooks/usePcoMomentMappings";
import { Loader2, Sparkles, ChevronRight } from "lucide-react";
import { iconMap } from "@/lib/flowIcons";
import { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [mergedMoments.length]);

  const scrollByAmount = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Flow Moments
          </span>
          {mergedMoments.length > 0 && canScrollRight && (
            <span className="text-xs text-muted-foreground font-normal flex items-center gap-1 sm:hidden">
              Swipe <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mergedMoments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No moment types mapped to PCO fields
          </p>
        ) : (
          <div className="relative">
            <div
              ref={scrollRef}
              className="flex overflow-x-auto gap-6 pb-4 px-1 snap-x snap-mandatory scroll-smooth [scrollbar-width:thin]"
            >
              {mergedMoments.map((moment) => (
                <div key={moment.id} className="snap-start shrink-0">
                  <MomentBadge moment={moment} />
                </div>
              ))}
            </div>

            {/* Left fade */}
            <div
              className={cn(
                "pointer-events-none absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-card to-transparent transition-opacity",
                canScrollLeft ? "opacity-100" : "opacity-0"
              )}
            />
            {/* Right fade + chevron hint */}
            <div
              className={cn(
                "pointer-events-none absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-card to-transparent flex items-center justify-end pr-1 transition-opacity",
                canScrollRight ? "opacity-100" : "opacity-0"
              )}
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground animate-pulse" />
            </div>

            {/* Desktop arrow buttons */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollByAmount(-1)}
                aria-label="Scroll left"
                className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 items-center justify-center rounded-full bg-background border shadow-sm hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollByAmount(1)}
                aria-label="Scroll right"
                className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 items-center justify-center rounded-full bg-background border shadow-sm hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
