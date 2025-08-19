
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

  const getTagStyle = (tag: string) => {
    switch (tag) {
      case 'active':
      case 'First Time Guest':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'partner':
      case 'Partner':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Serving':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <Link to={`/contacts/${contact.id}`}>
            <Avatar className="h-10 w-10 cursor-pointer">
              {avatar ? (
                <img src={avatar} alt={name} className="rounded-full" />
              ) : (
                <div className="bg-blue-500 text-white rounded-full w-full h-full flex items-center justify-center text-sm font-medium">
                  {name.charAt(0)}
                </div>
              )}
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={`/contacts/${contact.id}`} className="hover:text-blue-600 transition-colors">
              <h4 className="font-medium text-sm text-gray-900 truncate">{name}</h4>
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {assignedTo && (
            <Avatar className="h-6 w-6">
              {assignedTo.avatar ? (
                <img src={assignedTo.avatar} alt={assignedTo.name} className="rounded-full" />
              ) : (
                <div className="bg-gray-400 text-white rounded-full w-full h-full flex items-center justify-center text-xs">
                  {assignedTo.name.charAt(0)}
                </div>
              )}
            </Avatar>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded">
                <MoreVertical className="h-4 w-4 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white">
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
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.map((tag, index) => (
            <span 
              key={index}
              className={`text-xs px-2 py-1 rounded border font-medium ${getTagStyle(tag)}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Last: {date}</span>
        <div className="w-4 h-4 text-gray-400">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
};
