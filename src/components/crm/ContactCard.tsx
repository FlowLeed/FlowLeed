
import React from "react";
import { Contact } from "@/types/crm";
import { Avatar } from "@/components/ui/avatar";
import { 
  MoreVertical, 
  MessageSquare, 
  Mail, 
  Phone,
  Clock,
  ChevronRight
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
    <div className="contact-card cursor-pointer group">
      <div className="flex items-center gap-4 p-4">
        {/* Avatar on the left */}
        <Link to={`/contacts/${contact.id}`}>
          <Avatar className="h-12 w-12 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all">
            {avatar ? (
              <img src={avatar} alt={name} className="rounded-full object-cover" />
            ) : (
              <div className="bg-crm-primary text-white rounded-full w-full h-full flex items-center justify-center text-base font-semibold">
                {name.charAt(0)}
              </div>
            )}
          </Avatar>
        </Link>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Name and dropdown menu row */}
          <div className="flex items-center justify-between mb-2">
            <Link to={`/contacts/${contact.id}`} className="hover:text-blue-600 transition-colors">
              <h4 className="font-semibold text-lg text-gray-900 truncate">{name}</h4>
            </Link>
            
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border shadow-lg z-50">
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
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {tags.includes("active") && (
                <span className="px-2.5 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-full border border-teal-200">
                  First Time Guest
                </span>
              )}
              {tags.includes("partner") && (
                <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full border border-green-200">
                  Partner
                </span>
              )}
              {tags.includes("florida") && (
                <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                  Serving
                </span>
              )}
              {tags.includes("location") && (
                <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                  Location
                </span>
              )}
            </div>
          )}

          {/* Timestamp and assigned user row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>Last: {date}</span>
            </div>
            
            {assignedTo && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {assignedTo.avatar ? (
                    <img src={assignedTo.avatar} alt={assignedTo.name} className="rounded-full object-cover" />
                  ) : (
                    <div className="bg-gray-400 text-white rounded-full w-full h-full flex items-center justify-center text-xs font-medium">
                      {assignedTo.name.charAt(0)}
                    </div>
                  )}
                </Avatar>
                
                {/* Action buttons - hidden by default, shown on hover */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {phone && (
                    <a 
                      href={`sms:${phone}`} 
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" 
                      title="Send text message"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {email && (
                    <a 
                      href={`mailto:${email}`} 
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                      title="Send email"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {phone && (
                    <a 
                      href={`tel:${phone}`} 
                      className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                      title="Call"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
