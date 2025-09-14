import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserX, Users } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  email: string;
}

interface FlowTeamFilterProps {
  teamMembers: TeamMember[];
  selectedFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  contactCounts: {
    all: number;
    unassigned: number;
    byMember: Record<string, number>;
  };
}

export const FlowTeamFilter: React.FC<FlowTeamFilterProps> = ({
  teamMembers,
  selectedFilter,
  onFilterChange,
  contactCounts
}) => {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 border-b">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Filter by assignee:</span>
      </div>
      
      <div className="flex items-center gap-2 flex-wrap">
        {/* All filter */}
        <Button
          variant={selectedFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange(null)}
          className="flex items-center gap-2"
        >
          <Users className="h-3 w-3" />
          All
          <Badge variant="secondary" className="ml-1 text-xs">
            {contactCounts.all}
          </Badge>
        </Button>

        {/* Unassigned filter */}
        <Button
          variant={selectedFilter === "unassigned" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("unassigned")}
          className="flex items-center gap-2"
        >
          <UserX className="h-3 w-3" />
          Unassigned
          <Badge variant="secondary" className="ml-1 text-xs">
            {contactCounts.unassigned}
          </Badge>
        </Button>

        {/* Team member filters */}
        {teamMembers.map((member) => {
          const count = contactCounts.byMember[member.id] || 0;
          const isSelected = selectedFilter === member.id;
          
          return (
            <Button
              key={member.id}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onFilterChange(member.id)}
              className="flex items-center gap-2"
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={member.avatar} alt={member.name} />
                <AvatarFallback className="bg-gray-400 text-white text-xs">
                  {member.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-20">
                {(() => {
                  const nameParts = member.name.split(' ');
                  const firstName = nameParts[0] || '';
                  const lastNameInitial = nameParts[1]?.charAt(0) || '';
                  return `${firstName}${lastNameInitial ? ` ${lastNameInitial}.` : ''}`;
                })()}
              </span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {selectedFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange(null)}
          className="text-gray-500 hover:text-gray-700"
        >
          Clear filter
        </Button>
      )}
    </div>
  );
};