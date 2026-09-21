import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Filter, UserX, X, CheckCircle2, Activity, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCampuses } from "@/hooks/useCampuses";
import { useEngagementLabels } from "@/hooks/useEngagementSettings";
import { LEVEL_ORDER } from "@/lib/engagementSettings";

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  email: string;
}

type EngagementLevel = 'highly_engaged' | 'active' | 'at_risk' | 'inactive' | 'new';

const ENGAGEMENT_LEVEL_COLORS: Record<EngagementLevel, string> = {
  highly_engaged: 'text-emerald-600',
  active: 'text-blue-600',
  at_risk: 'text-amber-600',
  inactive: 'text-red-600',
  new: 'text-purple-600',
};

interface FlowHeaderFiltersProps {
  teamMembers: TeamMember[];
  selectedFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  contactCounts: {
    all: number;
    unassigned: number;
    byMember: Record<string, number>;
  };
  showCompleted: boolean;
  onShowCompletedChange: (show: boolean) => void;
  completedCount: number;
  selectedEngagementFilter?: string | null;
  onEngagementFilterChange?: (level: string | null) => void;
  selectedCampusFilter?: string | null;
  onCampusFilterChange?: (campusId: string | null) => void;
}

export const FlowHeaderFilters: React.FC<FlowHeaderFiltersProps> = ({
  teamMembers,
  selectedFilter,
  onFilterChange,
  contactCounts,
  showCompleted,
  onShowCompletedChange,
  completedCount,
  selectedEngagementFilter,
  onEngagementFilterChange,
  selectedCampusFilter,
  onCampusFilterChange
}) => {
  const { data: campuses } = useCampuses();
  const { labels: engagementLabelNames } = useEngagementLabels();
  const engagementLevels = LEVEL_ORDER.map((value) => ({
    value: value as EngagementLevel,
    label: engagementLabelNames[value],
    color: ENGAGEMENT_LEVEL_COLORS[value as EngagementLevel],
  }));
  
  const activeFilterCount = [
    selectedFilter !== null,
    showCompleted,
    selectedEngagementFilter != null,
    selectedCampusFilter != null,
  ].filter(Boolean).length;
  const hasActiveFilter = activeFilterCount > 0;

  return (
    <Popover>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 relative">
                <Filter className="h-4 w-4" />
                {hasActiveFilter && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Filter</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-[calc(100vw-1.5rem)] max-w-sm" align="end">
        <div className="space-y-4">
          {/* Show Completed toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <label htmlFor="show-completed" className="text-sm font-medium">
                Show Completed ({completedCount})
              </label>
            </div>
            <Switch
              id="show-completed"
              checked={showCompleted}
              onCheckedChange={onShowCompletedChange}
            />
          </div>

          {teamMembers.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <label className="text-sm font-medium">Assigned to</label>
              <div className="space-y-2">
                {/* Unassigned option */}
                <Button
                  variant={selectedFilter === "unassigned" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onFilterChange(selectedFilter === "unassigned" ? null : "unassigned")}
                  className="w-full justify-start gap-2"
                >
                  <UserX className="h-4 w-4" />
                  Unassigned ({contactCounts.unassigned})
                </Button>

                {/* Team member options */}
                {teamMembers.map((member) => {
                  const count = contactCounts.byMember[member.id] || 0;
                  const isSelected = selectedFilter === member.id;
                  const initials = member.name
                    .split(' ')
                    .map(n => n.charAt(0))
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                  
                  return (
                    <Button
                      key={member.id}
                      variant={isSelected ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => onFilterChange(isSelected ? null : member.id)}
                      className="w-full justify-start gap-2"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback className="text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {member.name} ({count})
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Engagement Level filter */}
          {onEngagementFilterChange && (
            <div className="border-t pt-4 space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Engagement Level
              </label>
              <div className="space-y-1">
                {engagementLevels.map((level) => (
                  <Button
                    key={level.value}
                    variant={selectedEngagementFilter === level.value ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() =>
                      onEngagementFilterChange(
                        selectedEngagementFilter === level.value ? null : level.value
                      )
                    }
                    className="w-full justify-start gap-2"
                  >
                    <span className={cn("text-xs font-bold", level.color)}>●</span>
                    {level.label}
                  </Button>
                ))}
                <Button
                  variant={selectedEngagementFilter === "paused" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() =>
                    onEngagementFilterChange(selectedEngagementFilter === "paused" ? null : "paused")
                  }
                  className="w-full justify-start gap-2"
                >
                  <span className="text-xs font-bold text-amber-600">●</span>
                  Paused (life season)
                </Button>
              </div>
            </div>
          )}

          {/* Campus filter */}
          {onCampusFilterChange && campuses && campuses.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Campus
              </label>
              <div className="space-y-1">
                {campuses.map((campus) => (
                  <Button
                    key={campus.id}
                    variant={selectedCampusFilter === campus.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() =>
                      onCampusFilterChange(
                        selectedCampusFilter === campus.id ? null : campus.id
                      )
                    }
                    className="w-full justify-start gap-2"
                  >
                    {campus.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {(selectedFilter !== null || selectedEngagementFilter != null || selectedCampusFilter != null) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                onFilterChange(null);
                onEngagementFilterChange?.(null);
                onCampusFilterChange?.(null);
              }} 
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              Clear All Filters
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};