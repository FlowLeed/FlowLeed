import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserX, MoreHorizontal } from "lucide-react";
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
  const maxVisibleFilters = 6;
  const visibleMembers = teamMembers.slice(0, maxVisibleFilters - 1); // Reserve space for unassigned
  const hasMoreMembers = teamMembers.length > maxVisibleFilters - 1;

  return (
    <div className="flex items-center gap-2">
      {/* Unassigned filter */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onFilterChange(selectedFilter === "unassigned" ? null : "unassigned")}
        className={cn(
          "h-8 w-8 p-0 rounded-full border-2 transition-all",
          selectedFilter === "unassigned"
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        )}
        title={`Unassigned (${contactCounts.unassigned})`}
      >
        <UserX className="h-4 w-4 text-muted-foreground" />
      </Button>

      {/* Team member filters */}
      {visibleMembers.map((member) => {
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
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange(isSelected ? null : member.id)}
            className={cn(
              "h-8 w-8 p-0 rounded-full border-2 transition-all",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-muted-foreground/20 hover:border-muted-foreground/40"
            )}
            title={`${member.name} (${count})`}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={member.avatar} alt={member.name} />
              <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        );
      })}

      {/* More filters indicator */}
      {hasMoreMembers && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-full border-2 border-muted-foreground/20 hover:border-muted-foreground/40"
          title={`${teamMembers.length - visibleMembers.length} more filters`}
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
};