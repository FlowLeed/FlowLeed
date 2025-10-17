import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageSquare, Mail, Phone, MoreVertical } from "lucide-react";

interface SupportTicket {
  id: string;
  organizationName: string;
  subject: string;
  priority: "high" | "medium" | "low";
  daysOpen: number;
  assignedTo?: {
    name: string;
    avatar?: string;
  };
}

interface AdminTicketCardProps {
  ticket: SupportTicket;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
      return "secondary";
    default:
      return "secondary";
  }
};

export const AdminTicketCard: React.FC<AdminTicketCardProps> = ({
  ticket,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="bg-background p-3 border-2 border-border rounded-xl space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm truncate">{ticket.organizationName}</h4>
          <p className="text-xs text-muted-foreground truncate">{ticket.subject}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 -mt-1">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(ticket.id)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete?.(ticket.id)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={getPriorityColor(ticket.priority)} className="text-[10px] px-1.5 py-0">
          {ticket.priority}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {ticket.daysOpen} day{ticket.daysOpen !== 1 ? 's' : ''} open
        </span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          <Avatar className="h-4 w-4">
            <AvatarImage src={ticket.assignedTo?.avatar} />
            <AvatarFallback className="bg-muted text-[9px]">
              {ticket.assignedTo?.name.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground">
            {ticket.assignedTo?.name || 'Unassigned'}
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
