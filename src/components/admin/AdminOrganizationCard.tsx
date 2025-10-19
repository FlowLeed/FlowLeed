import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageSquare, Mail, Phone, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OnboardingOrganization {
  id: string;
  name: string;
  admin: {
    name: string;
    email: string;
    avatar?: string;
  };
  daysInStage: number;
  assignedTo?: {
    name: string;
    avatar?: string;
  };
}

interface AdminOrganizationCardProps {
  organization: OnboardingOrganization;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const getDaysInStage = (days: number): string => {
  return `${days} day${days !== 1 ? 's' : ''} in stage`;
};

export const AdminOrganizationCard: React.FC<AdminOrganizationCardProps> = ({
  organization,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    navigate(`/fl-admin/organizations/${organization.id}`);
  };

  return (
    <div 
      className="bg-background p-3 border-2 border-border rounded-xl space-y-2 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={organization.admin.avatar} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {organization.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm truncate">{organization.name}</h4>
              <p className="text-xs text-muted-foreground truncate">{organization.admin.name}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 -mt-1">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit?.(organization.id)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onDelete?.(organization.id)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {getDaysInStage(organization.daysInStage)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          <Avatar className="h-4 w-4">
            <AvatarImage src={organization.assignedTo?.avatar} />
            <AvatarFallback className="bg-muted text-[9px]">
              {organization.assignedTo?.name.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground">
            {organization.assignedTo?.name || 'Unassigned'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 opacity-60 hover:opacity-100">
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 opacity-60 hover:opacity-100">
            <Mail className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 opacity-60 hover:opacity-100">
            <Phone className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
