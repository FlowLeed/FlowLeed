import React from "react";
import { Contact } from "@/types/crm";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MoreVertical, MessageSquare, Mail, Phone, UserX, CheckCircle2, Building2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { useEngagementScore } from "@/hooks/useCheckinData";
import { EngagementBadge } from "@/components/contact/EngagementBadge";

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
}
export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onEdit,
  onDelete,
  pipelineId,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  isCompleted = false
}) => {
  const {
    name,
    avatar,
    date,
    tags,
    assignedTo,
    email,
    phone,
    stageEnteredAt
  } = contact;
  const { data: engagementScore } = useEngagementScore(contact.id);
  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectMode) {
      e.preventDefault();
      onToggleSelect?.();
    }
  };
  return <div className={`contact-card bg-white p-3 border-2 mb-3 transition-all duration-200 rounded-xl overflow-hidden max-w-full cursor-pointer ${isSelectMode ? isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50' : 'border-gray-200 hover:border-blue-300'} ${isCompleted ? 'opacity-50' : ''}`} onClick={handleCardClick}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 items-center min-w-0 flex-1">
          {isSelectMode ? <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
              <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} className="h-5 w-5" />
            </div> : <Link to={`/contacts/${contact.id}${pipelineId ? `?pipelineId=${pipelineId}` : ''}`} className="flex-shrink-0">
              <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all">
                {avatar ? <img src={avatar} alt={name} className="rounded-full" /> : <div className="bg-crm-primary text-white rounded-full w-full h-full flex items-center justify-center">
                    {name.charAt(0)}
                  </div>}
              </Avatar>
            </Link>}
          <div className="min-w-0 flex-1">
            {isSelectMode ? <>
                <h4 className="font-light text-sm truncate" title={name}>{name}</h4>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>In stage: {getDaysInStage(stageEnteredAt)} days</span>
                </div>
              </> : <>
                <Link to={`/contacts/${contact.id}${pipelineId ? `?pipelineId=${pipelineId}` : ''}`} className="hover:text-blue-600 transition-colors">
                  <h4 title={name} className="text-sm cursor-pointer truncate font-light">{name}</h4>
                </Link>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
                  {isCompleted ? (
                    <Badge variant="secondary" className="text-xs gap-1 py-0 h-5">
                      <CheckCircle2 className="h-3 w-3" />
                      Done
                    </Badge>
                  ) : (
                    <span>In stage: {getDaysInStage(stageEnteredAt)} days</span>
                  )}
                  <EngagementBadge score={engagementScore} compact />
                </div>
              </>}
          </div>
        </div>
        {!isSelectMode && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="action-button" onClick={e => e.stopPropagation()}>
                <MoreVertical className="h-4 w-4" />
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

      {tags && tags.length > 0 && <div className="flex gap-1.5 mb-3 flex-wrap">
          {tags.map((tag, index) => (
            <span key={index} className="tag bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full capitalize">
              {tag}
            </span>
          ))}
        </div>}

      {contact.campusName && (
        <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span>{contact.campusName}</span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        {assignedTo ? <div className="flex gap-2 items-center min-w-0 flex-1">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={assignedTo.avatar} alt={assignedTo.name} />
              <AvatarFallback className="bg-gray-300 text-white text-xs">
                {assignedTo.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-600 truncate" title={assignedTo.name}>
              {(() => {
            const nameParts = assignedTo.name.split(' ');
            const firstName = nameParts[0] || '';
            const lastNameInitial = nameParts[1]?.charAt(0) || '';
            return `${firstName}${lastNameInitial ? ` ${lastNameInitial}.` : ''}`;
          })()}
            </span>
          </div> : <div className="flex gap-2 items-center min-w-0 flex-1">
            <div className="h-6 w-6 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
              <UserX className="h-4 w-4 text-gray-400" />
            </div>
            <span className="text-xs text-gray-500">Unassigned</span>
          </div>}
        <div className="flex gap-1 flex-shrink-0">
          {phone && <a href={`sms:${phone}`} className="action-button p-1 hover:bg-gray-100 rounded-full" title="Send text message">
              <MessageSquare className="h-3.5 w-3.5" />
            </a>}
          {email && <a href={`mailto:${email}`} className="action-button p-1 hover:bg-gray-100 rounded-full" title="Send email">
              <Mail className="h-3.5 w-3.5" />
            </a>}
          {phone && <a href={`tel:${phone}`} className="action-button p-1 hover:bg-gray-100 rounded-full" title="Call">
              <Phone className="h-3.5 w-3.5" />
            </a>}
        </div>
      </div>
    </div>;
};