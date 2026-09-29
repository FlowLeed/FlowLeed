import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { User, ArrowUpDown, ArrowUp, ArrowDown, MapPin } from "lucide-react";
import { useState } from "react";
import { SignalChip, SIGNAL_RISK_ORDER } from "@/components/contact/SignalChip";
import type { SignalLevel } from "@/hooks/useContactSignal";
import { LoadingStatus } from "@/components/contacts/LoadingStatus";
import { MobilePersonRow } from "@/components/contacts/MobilePersonRow";
import { MessagingChannelLinks } from "@/components/contact/MessagingChannelLinks";

interface ContactsTableProps {
  contacts: any[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
}

export const ContactsTable = ({ contacts, isLoading, hasActiveFilters, selectedIds, onToggleSelect, onToggleSelectAll }: ContactsTableProps) => {
  const selectionEnabled = !!onToggleSelect;
  const navigate = useNavigate();
  // Default sort: most at risk first
  const [sortField, setSortField] = useState<string | null>("signal");
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

  const getScore = (c: any) => {
    const s = c.contact_engagement_scores;
    return Array.isArray(s) ? s[0] : s;
  };

  const sortedContacts = sortField ? [...(contacts || [])].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    
    if (sortField === 'name') {
      aVal = a.name?.toLowerCase() || '';
      bVal = b.name?.toLowerCase() || '';
    } else if (sortField === 'assignedTo') {
      aVal = a.profiles?.full_name?.toLowerCase() || '';
      bVal = b.profiles?.full_name?.toLowerCase() || '';
    } else if (sortField === 'campus') {
      aVal = a.campuses?.name?.toLowerCase() || '';
      bVal = b.campuses?.name?.toLowerCase() || '';
    } else if (sortField === 'signal') {
      const aSig = getScore(a)?.signal as SignalLevel | undefined;
      const bSig = getScore(b)?.signal as SignalLevel | undefined;
      aVal = aSig ? SIGNAL_RISK_ORDER[aSig] : 99;
      bVal = bSig ? SIGNAL_RISK_ORDER[bSig] : 99;
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }) : contacts;

  if (isLoading || contacts === undefined) {
    return <LoadingStatus />;
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
    <>
      <div className="divide-y rounded-lg border bg-card md:hidden">
        {selectionEnabled && (
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 px-3 text-sm font-medium"
            onClick={() => onToggleSelectAll?.(sortedContacts.map((contact: any) => contact.id))}
          >
            <Checkbox
              checked={sortedContacts.length > 0 && sortedContacts.every((contact: any) => selectedIds?.has(contact.id))}
              aria-label="Select all people"
            />
            Select all people
          </button>
        )}
        {sortedContacts.map((contact: any) => {
          const score = getScore(contact);
          return (
            <MobilePersonRow
              key={contact.id}
              name={contact.name}
              avatar={contact.avatar}
              email={contact.email}
              phone={contact.phone}
              campus={contact.campuses?.name}
              selected={selectedIds?.has(contact.id)}
              onSelect={selectionEnabled ? () => onToggleSelect?.(contact.id) : undefined}
              onOpen={() => navigate(`/contacts/${contact.id}`)}
              status={<SignalChip signal={(score?.signal as SignalLevel) ?? null} />}
              details={contact.profiles?.full_name ? <span>With {contact.profiles.full_name}</span> : undefined}
            />
          );
        })}
      </div>
      <div className="hidden rounded-md border md:block">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            {selectionEnabled && (
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    sortedContacts && sortedContacts.length > 0 &&
                    sortedContacts.every((c: any) => selectedIds?.has(c.id))
                  }
                  onCheckedChange={() => {
                    onToggleSelectAll?.(sortedContacts.map((c: any) => c.id));
                  }}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead 
              className="cursor-pointer select-none group"
              onClick={() => handleSort('name')}
            >
              Name{getSortIcon('name')}
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none group"
              onClick={() => handleSort('signal')}
            >
              Signal{getSortIcon('signal')}
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
              onClick={() => handleSort('campus')}
            >
              Campus{getSortIcon('campus')}
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none group"
              onClick={() => handleSort('assignedTo')}
            >
              Assigned To{getSortIcon('assignedTo')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedContacts.map((contact, index) => {
            const score = getScore(contact);
            const isSelected = selectedIds?.has(contact.id);
            return (
              <TableRow
                key={contact.id}
                data-state={isSelected ? "selected" : undefined}
                className={`cursor-pointer hover:bg-muted/50 ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                {selectionEnabled && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect?.(contact.id)}
                      aria-label={`Select ${contact.name}`}
                    />
                  </TableCell>
                )}
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
                <TableCell>
                  <SignalChip signal={(score?.signal as SignalLevel) ?? null} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.email || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{contact.phone || "—"}</span>
                    <MessagingChannelLinks contact={contact} />
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {contact.campuses?.name ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {contact.campuses.name}
                    </span>
                  ) : "—"}
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </>
  );
};
