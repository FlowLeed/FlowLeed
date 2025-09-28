import React, { useState, useEffect } from "react";
import { Search, Phone, Mail, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlowIconBadge } from "./FlowIconBadge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

interface SearchContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  flows: Array<{
    name: string;
    icon: string;
  }>;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ open, onOpenChange }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { organization } = useProfile();
  const navigate = useNavigate();

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim() || !organization) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select(`
            id,
            name,
            email,
            phone,
            avatar
          `)
          .eq('organization_id', organization.id)
          .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
          .limit(8);

        if (error) throw error;

        // Transform the data to group flows by contact
        const contactsMap = new Map<string, SearchContact>();
        
        data?.forEach((contact: any) => {
          if (!contactsMap.has(contact.id)) {
            contactsMap.set(contact.id, {
              id: contact.id,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              avatar: contact.avatar,
              flows: []
            });
          }
          
          const existingContact = contactsMap.get(contact.id)!;
          contact.pipeline_contacts?.forEach((pc: any) => {
            if (pc.pipelines && !existingContact.flows.some(f => f.name === pc.pipelines.name)) {
              existingContact.flows.push({
                name: pc.pipelines.name,
                icon: pc.pipelines.icon || 'Users'
              });
            }
          });
        });

        setSearchResults(Array.from(contactsMap.values()));
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, organization]);

  const handleSelectContact = (contactId: string) => {
    navigate(`/contacts/${contactId}`);
    onOpenChange(false);
    setSearchQuery("");
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search people by name, email, or phone..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Searching..." : "No contacts found."}
        </CommandEmpty>
        {searchResults.length > 0 && (
          <CommandGroup heading="People">
            {searchResults.map((contact) => (
              <CommandItem
                key={contact.id}
                value={`${contact.name} ${contact.email ?? ''} ${contact.phone ?? ''}`}
                onSelect={() => handleSelectContact(contact.id)}
                className="flex items-center gap-3 p-3 cursor-pointer"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={contact.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.email}`} />
                  <AvatarFallback>
                    {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {highlightMatch(contact.name, searchQuery)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    {contact.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{highlightMatch(contact.email, searchQuery)}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span>{highlightMatch(contact.phone, searchQuery)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Flow badges */}
                  <div className="flex items-center gap-1">
                    {contact.flows.slice(0, 3).map((flow, index) => (
                      <FlowIconBadge key={index} flow={flow} size="sm" />
                    ))}
                    {contact.flows.length > 3 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                        +{contact.flows.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Quick action buttons */}
                  <div className="flex gap-1">
                    {contact.phone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`tel:${contact.phone}`, '_self');
                        }}
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                    )}
                    {contact.email && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`mailto:${contact.email}`, '_self');
                        }}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};