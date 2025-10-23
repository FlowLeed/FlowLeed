import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, UserX, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  email: string;
}

interface FlowHeaderFiltersProps {
  teamMembers: TeamMember[];
  selectedFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  contactCounts: {
    all: number;
    unassigned: number;
    byMember: Record<string, number>;
  };
}

export const FlowHeaderFilters: React.FC<FlowHeaderFiltersProps> = ({
  teamMembers,
  selectedFilter,
  onFilterChange,
  contactCounts
}) => {
  const hasActiveFilter = selectedFilter !== null;

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
          <div className="space-y-2">
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

          {hasActiveFilter && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onFilterChange(null)} 
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              Clear Filter
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};