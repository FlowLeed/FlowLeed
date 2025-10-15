import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { User, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";

interface ContactsTableProps {
  contacts: any[];
  isLoading: boolean;
  hasActiveFilters: boolean;
}

export const ContactsTable = ({ contacts, isLoading, hasActiveFilters }: ContactsTableProps) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-0 group-hover:opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 inline" />
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
  };

  const sortedContacts = sortField ? [...contacts].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (sortField === 'name') {
      aVal = a.name?.toLowerCase() || '';
      bVal = b.name?.toLowerCase() || '';
    } else if (sortField === 'assignedTo') {
      aVal = a.profiles?.full_name?.toLowerCase() || '';
      bVal = b.profiles?.full_name?.toLowerCase() || '';
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }) : contacts;

  console.log('📊 ContactsTable render:', { 
    contactsCount: contacts?.length,
    isLoading,
    hasActiveFilters,
    contactsUndefined: contacts === undefined
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading people...
      </div>
    );
  }

  if (contacts === undefined) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Initializing...
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground font-light">
          {hasActiveFilters
            ? "No people match your filters. Try adjusting your search criteria."
            : "No people yet. Add your first person to get started!"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead 
              className="cursor-pointer select-none group"
              onClick={() => handleSort('name')}
            >
              Name{getSortIcon('name')}
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none group"
              onClick={() => handleSort('email')}
            >
              Email{getSortIcon('email')}
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none group"
              onClick={() => handleSort('phone')}
            >
              Phone{getSortIcon('phone')}
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none group"
              onClick={() => handleSort('assignedTo')}
            >
              Assigned To{getSortIcon('assignedTo')}
            </TableHead>
            <TableHead>Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedContacts.map((contact, index) => (
            <TableRow
              key={contact.id}
              className={`cursor-pointer hover:bg-muted/50 ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
              onClick={() => navigate(`/contacts/${contact.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={contact.avatar} />
                    <AvatarFallback>
                      {contact.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{contact.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.email || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.phone || "—"}
              </TableCell>
              <TableCell>
                {contact.profiles ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={contact.profiles.avatar_url} />
                      <AvatarFallback>
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {contact.profiles.full_name}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {contact.contact_tags?.slice(0, 3).map((tagObj: any, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {tagObj.tag}
                    </Badge>
                  ))}
                  {contact.contact_tags?.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{contact.contact_tags.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
