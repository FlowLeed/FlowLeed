
import React from "react";
import { Contact } from "@/types/crm";
import { Avatar } from "@/components/ui/avatar";
import { 
  MoreVertical, 
  MessageSquare, 
  Mail, 
  Phone 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ContactCardProps {
  contact: Contact;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onEdit,
  onDelete,
}) => {
  const { name, avatar, date, tags, assignedTo } = contact;

  return (
    <div className="contact-card mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 items-center">
          <Avatar className="h-8 w-8">
            {avatar ? (
              <img src={avatar} alt={name} className="rounded-full" />
            ) : (
              <div className="bg-crm-primary text-white rounded-full w-full h-full flex items-center justify-center">
                {name.charAt(0)}
              </div>
            )}
          </Avatar>
          <div>
            <h4 className="font-medium text-sm">{name}</h4>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>{date}</span>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="action-button">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(contact)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete?.(contact)}
              className="text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {tags && tags.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {tags.includes("active") && (
            <span className="tag tag-active">Active</span>
          )}
          {tags.includes("partner") && (
            <span className="tag tag-partner">Partner</span>
          )}
          {tags.includes("florida") && (
            <span className="tag tag-location">Florida</span>
          )}
          {tags.includes("location") && (
            <span className="tag tag-location">Location</span>
          )}
        </div>
      )}

      {assignedTo && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <Avatar className="h-6 w-6">
              {assignedTo.avatar ? (
                <img src={assignedTo.avatar} alt={assignedTo.name} className="rounded-full" />
              ) : (
                <div className="bg-gray-300 text-white rounded-full w-full h-full flex items-center justify-center text-xs">
                  {assignedTo.name.charAt(0)}
                </div>
              )}
            </Avatar>
            <span className="text-xs text-gray-600">{assignedTo.name}</span>
          </div>
          <div className="flex gap-1">
            <button className="action-button">
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            <button className="action-button">
              <Mail className="h-3.5 w-3.5" />
            </button>
            <button className="action-button">
              <Phone className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
