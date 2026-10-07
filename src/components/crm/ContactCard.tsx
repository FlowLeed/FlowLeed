import React from "react";
import { Contact } from "@/types/crm";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MoreVertical, MessageSquare, Mail, Phone, UserX, CheckCircle2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { useEngagementScore } from "@/hooks/useCheckinData";
import { EngagementBadge } from "@/components/contact/EngagementBadge";
import { MessagingChannelLinks } from "@/components/contact/MessagingChannelLinks";
import { FlowFormSubmission, FlowSubmissionDialog } from "@/components/forms/FlowSubmissionDialog";

// Helper function to calculate days in current stage
const getDaysInStage = (stageEnteredAt?: string): number => {
  if (!stageEnteredAt) return 0;
  try {
    const enteredDate = new Date(stageEnteredAt);
    const today = new Date();
    return Math.max(0, differenceInDays(today, enteredDate));
  } catch {
    return 0;
  }
};
interface ContactCardProps {
  contact: Contact;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  pipelineId?: string;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isCompleted?: boolean;
  formSubmissions?: FlowFormSubmission[];
}
export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onEdit,
  onDelete,
  pipelineId,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  isCompleted = false,
  formSubmissions = []
}) => {
  const {
    name,
    avatar,
    tags,
    assignedTo,
    email,
    phone,
    stageEnteredAt,
    campusName
  } = contact;
  const { data: engagementScore } = useEngagementScore(contact.id);
  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectMode) {
      e.preventDefault();
      onToggleSelect?.();
    }
  };
  const cardLink = `/contacts/${contact.id}${pipelineId ? `?pipelineId=${pipelineId}` : ''}`;

  return <div className={`relative bg-card text-card-foreground p-3 border shadow-sm hover:shadow-md mb-3 transition-all duration-200 rounded-lg overflow-hidden w-full min-w-0 cursor-pointer ${isSelectMode ? isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50' : 'border-border hover:border-primary/50'} ${isCompleted ? 'opacity-50' : ''}`} onClick={handleCardClick}>
      {/* Row 1: identity + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {isSelectMode ? <div className="flex h-8 shrink-0 items-center" onClick={e => e.stopPropagation()}>
              <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} className="h-5 w-5" />
            </div> : <Link to={cardLink} className="shrink-0">
              <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                <AvatarImage src={avatar || undefined} alt={name} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">{name.charAt(0)}</AvatarFallback>
              </Avatar>
            </Link>}
          <div className="min-w-0 flex-1">
            <Link to={cardLink} className="hover:text-primary transition-colors">
              <h4 title={name} className="text-sm cursor-pointer truncate font-light">{name}</h4>
            </Link>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
              {isCompleted ? (
                <span className="inline-flex shrink-0 items-center gap-1"><CheckCircle2 className="h-3 w-3" strokeWidth={1.7} />Done</span>
              ) : (
                <span className="shrink-0">{getDaysInStage(stageEnteredAt)}d in stage</span>
              )}
              {campusName && <span className="shrink-0 truncate" title={campusName}>
                  · {campusName}
                </span>}
              {tags?.length > 0 && <span className="min-w-0 truncate text-primary" title={tags.join(", ")}>· {tags.join(", ")}</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {campusName && !isSelectMode && <EngagementBadge score={engagementScore} mini />}
          {!isSelectMode && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground" aria-label={`Actions for ${name}`} onClick={e => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" strokeWidth={1.7} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(contact)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete?.(contact)} className="text-destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
        </div>
      </div>

      {/* Row 2: assignee + quick actions */}
      <div className="mt-2 flex items-center justify-between gap-2">
        {assignedTo ? <Link to={cardLink} className="flex min-w-0 flex-1 items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={assignedTo.avatar} alt={assignedTo.name} className="object-cover" />
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                {assignedTo.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground" title={assignedTo.name}>
              {(() => {
            const nameParts = assignedTo.name.split(' ');
            const firstName = nameParts[0] || '';
            const lastNameInitial = nameParts[1]?.charAt(0) || '';
            return `${firstName}${lastNameInitial ? ` ${lastNameInitial}.` : ''}`;
          })()}
            </span>
          </Link> : <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
              <UserX className="h-3 w-3 text-muted-foreground" strokeWidth={1.7} />
            </div>
            <span className="truncate text-xs text-muted-foreground">Unassigned</span>
          </div>}
        <div className="flex shrink-0 items-center gap-1 justify-end">
          {formSubmissions.length > 0 && (
            <FlowSubmissionDialog contactName={name} submissions={formSubmissions} />
          )}
          <MessagingChannelLinks contact={contact} />
          {phone && <a href={`sms:${phone}`} className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-muted rounded-full" title="Send text message">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.7} />
            </a>}
          {email && <a href={`mailto:${email}`} className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-muted rounded-full" title="Send email">
              <Mail className="h-3.5 w-3.5" strokeWidth={1.7} />
            </a>}
          {phone && <a href={`tel:${phone}`} className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-muted rounded-full" title="Call">
              <Phone className="h-3.5 w-3.5" strokeWidth={1.7} />
            </a>}
        </div>
      </div>
    </div>;
};
