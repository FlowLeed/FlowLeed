import React from "react";
import { Contact } from "@/types/crm";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MoreVertical, MessageSquare, Mail, Phone } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { differenceInDays, parse } from "date-fns";

// Helper function to generate random days since activity
const getDaysSince = (dateString: string): number => {
  // Generate random number between 1 and 30 days
  return Math.floor(Math.random() * 30) + 1;
};
interface ContactCardProps {
  contact: Contact;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
}
export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onEdit,
  onDelete
}) => {
  const {
    name,
    avatar,
    date,
    tags,
    assignedTo,
    email,
    phone
  } = contact;
  return <div className="contact-card bg-white p-3 border border-gray-200 mb-3 hover:border-blue-300 transition-all duration-200 rounded-xl">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 items-center">
          <Link to={`/contacts/${contact.id}`}>
            <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all">
              {avatar ? <img src={avatar} alt={name} className="rounded-full" /> : <div className="bg-crm-primary text-white rounded-full w-full h-full flex items-center justify-center">
                  {name.charAt(0)}
                </div>}
            </Avatar>
          </Link>
          <div>
            <Link to={`/contacts/${contact.id}`} className="hover:text-blue-600 transition-colors">
              <h4 className="font-medium text-sm cursor-pointer">{name}</h4>
            </Link>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>Last: {getDaysSince(date)} days ago</span>
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
            <DropdownMenuItem onClick={() => onDelete?.(contact)} className="text-red-600">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {tags && tags.length > 0 && <div className="flex gap-1.5 mb-3 flex-wrap">
          {tags.includes("active") && <span className="tag bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Active</span>}
          {tags.includes("partner") && <span className="tag bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Partner</span>}
          {tags.includes("florida") && <span className="tag bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">Florida</span>}
          {tags.includes("location") && <span className="tag bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">Location</span>}
        </div>}

      {assignedTo && <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <Avatar className="h-6 w-6">
              <AvatarImage src={assignedTo.avatar} alt={assignedTo.name} />
              <AvatarFallback className="bg-gray-300 text-white text-xs">
                {assignedTo.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-600">{assignedTo.name}</span>
          </div>
          <div className="flex gap-1">
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
        </div>}
    </div>;
};