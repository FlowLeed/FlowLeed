import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Filter, UserX, X, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  email: string;
}

type EngagementLevel = 'highly_engaged' | 'active' | 'at_risk' | 'inactive' | 'new';

const ENGAGEMENT_LEVELS: { value: EngagementLevel; label: string; color: string }[] = [
  { value: 'highly_engaged', label: 'Highly Engaged', color: 'text-emerald-600' },
  { value: 'active', label: 'Active', color: 'text-blue-600' },
  { value: 'at_risk', label: 'At Risk', color: 'text-amber-600' },
  { value: 'inactive', label: 'Inactive', color: 'text-red-600' },
  { value: 'new', label: 'New', color: 'text-purple-600' },
];

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
  selectedEngagementFilter?: EngagementLevel | null;
  onEngagementFilterChange?: (level: EngagementLevel | null) => void;
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
  onEngagementFilterChange
}) => {
  const activeFilterCount = [
    selectedFilter !== null,
    showCompleted,
    selectedEngagementFilter != null,
  ].filter(Boolean).length;
  const hasActiveFilter = activeFilterCount > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
          {hasActiveFilter && (
            <Badge variant="secondary" className="ml-1 rounded-full px-2 py-0 text-xs">
              1
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
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

          {/* Engagement Level filter */}
          {onEngagementFilterChange && (
            <div className="border-t pt-4 space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Engagement Level
              </label>
              <div className="space-y-1">
                {ENGAGEMENT_LEVELS.map((level) => (
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
              </div>
            </div>
          )}

          {(selectedFilter !== null || selectedEngagementFilter != null) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                onFilterChange(null);
                onEngagementFilterChange?.(null);
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