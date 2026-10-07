import React from "react";
import { Contact } from "@/types/crm";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MoreVertical, MessageSquare, Mail, Phone, UserX, CheckCircle2, Building2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
    date,
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

  return <div className={`contact-card bg-white p-3 border-2 mb-3 transition-all duration-200 rounded-xl overflow-hidden max-w-full cursor-pointer ${isSelectMode ? isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50' : 'border-gray-200 hover:border-blue-300'} ${isCompleted ? 'opacity-50' : ''}`} onClick={handleCardClick}>
      {/* Row 1: identity + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {isSelectMode ? <div className="flex h-8 shrink-0 items-center" onClick={e => e.stopPropagation()}>
              <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} className="h-5 w-5" />
            </div> : <Link to={cardLink} className="shrink-0">
              <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all">
                {avatar ? <img src={avatar} alt={name} className="rounded-full" /> : <div className="bg-crm-primary text-white rounded-full w-full h-full flex items-center justify-center">
                    {name.charAt(0)}
                  </div>}
              </Avatar>
            </Link>}
          <div className="min-w-0 flex-1">
            <Link to={cardLink} className="hover:text-blue-600 transition-colors">
              <h4 title={name} className="text-sm cursor-pointer truncate font-light">{name}</h4>
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
              {isCompleted ? (
                <Badge variant="secondary" className="inline-flex items-center gap-1 px-1.5 py-0 h-5 text-xs">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={1.7} />
                  Done
                </Badge>
              ) : (
                <span>{getDaysInStage(stageEnteredAt)}d in stage</span>
              )}
              {campusName && <span className="inline-flex min-w-0 items-center gap-1">
                  <Building2 className="h-3 w-3 shrink-0" strokeWidth={1.7} />
                  <span className="truncate">{campusName}</span>
                </span>}
            </div>
            {tags && tags.length > 0 && <div className="mt-1 flex gap-1.5 flex-wrap">
                {tags.map((tag, index) => (
                  <span key={index} className="tag bg-blue-100 text-blue-800 text-[11px] px-1.5 py-0 rounded-full capitalize leading-4">
                    {tag}
                  </span>
                ))}
              </div>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {campusName && !isSelectMode && <EngagementBadge score={engagementScore} compact />}
          {!isSelectMode && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="action-button" onClick={e => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" strokeWidth={1.7} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(contact)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete?.(contact)} className="text-red-600">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
        </div>
      </div>

      {/* Row 2: assignee + quick actions */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {assignedTo ? <Link to={cardLink} className="flex min-w-0 flex-1 items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={assignedTo.avatar} alt={assignedTo.name} />
              <AvatarFallback className="bg-gray-300 text-white text-[10px]">
                {assignedTo.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-gray-600" title={assignedTo.name}>
              {(() => {
            const nameParts = assignedTo.name.split(' ');
            const firstName = nameParts[0] || '';
            const lastNameInitial = nameParts[1]?.charAt(0) || '';
            return `${firstName}${lastNameInitial ? ` ${lastNameInitial}.` : ''}`;
          })()}
            </span>
          </Link> : <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <UserX className="h-3 w-3 text-gray-400" strokeWidth={1.7} />
            </div>
            <span className="truncate text-xs text-gray-500">Unassigned</span>
          </div>}
        <div className="flex shrink-0 items-center gap-1 justify-end">
          {formSubmissions.length > 0 && (
            <FlowSubmissionDialog contactName={name} submissions={formSubmissions} />
          )}
          <MessagingChannelLinks contact={contact} />
          {phone && <a href={`sms:${phone}`} className="action-button p-1 hover:bg-gray-100 rounded-full" title="Send text message">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.7} />
            </a>}
          {email && <a href={`mailto:${email}`} className="action-button p-1 hover:bg-gray-100 rounded-full" title="Send email">
              <Mail className="h-3.5 w-3.5" strokeWidth={1.7} />
            </a>}
          {phone && <a href={`tel:${phone}`} className="action-button p-1 hover:bg-gray-100 rounded-full" title="Call">
              <Phone className="h-3.5 w-3.5" strokeWidth={1.7} />
            </a>}
        </div>
      </div>
    </div>;
};
