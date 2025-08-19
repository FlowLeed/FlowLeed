
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
import { Link } from "react-router-dom";

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
  const { name, avatar, date, tags, assignedTo, email, phone } = contact;

  return (
    <div className="contact-card">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3 items-center">
          <Link to={`/contacts/${contact.id}`}>
            <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all">
              {avatar ? (
                <img src={avatar} alt={name} className="rounded-full" />
              ) : (
                <div className="bg-crm-primary text-white rounded-full w-full h-full flex items-center justify-center text-sm font-medium">
                  {name.charAt(0)}
                </div>
              )}
            </Avatar>
          </Link>
          <div className="flex-1">
            <Link to={`/contacts/${contact.id}`} className="hover:text-blue-600 transition-colors">
              <h4 className="font-semibold text-base text-gray-900">{name}</h4>
            </Link>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <span>{date}</span>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border shadow-lg">
            <DropdownMenuItem 
              onClick={() => onEdit?.(contact)}
              className="hover:bg-gray-50"
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete?.(contact)}
              className="text-red-600 hover:bg-red-50"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {tags && tags.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {tags.includes("active") && (
            <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full border border-green-200">
              Active
            </span>
          )}
          {tags.includes("partner") && (
            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full border border-blue-200">
              Partner
            </span>
          )}
          {tags.includes("florida") && (
            <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full border border-yellow-200">
              Florida
            </span>
          )}
          {tags.includes("location") && (
            <span className="px-3 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full border border-purple-200">
              Location
            </span>
          )}
        </div>
      )}

      {assignedTo && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <Avatar className="h-7 w-7">
              {assignedTo.avatar ? (
                <img src={assignedTo.avatar} alt={assignedTo.name} className="rounded-full" />
              ) : (
                <div className="bg-gray-400 text-white rounded-full w-full h-full flex items-center justify-center text-xs font-medium">
                  {assignedTo.name.charAt(0)}
                </div>
              )}
            </Avatar>
            <span className="text-sm text-gray-700 font-medium">{assignedTo.name}</span>
          </div>
          <div className="flex gap-2">
            {phone && (
              <a 
                href={`sms:${phone}`} 
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" 
                title="Send text message"
              >
                <MessageSquare className="h-4 w-4" />
              </a>
            )}
            {email && (
              <a 
                href={`mailto:${email}`} 
                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                title="Send email"
              >
                <Mail className="h-4 w-4" />
              </a>
            )}
            {phone && (
              <a 
                href={`tel:${phone}`} 
                className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                title="Call"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
