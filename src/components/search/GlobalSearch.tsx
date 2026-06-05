import React, { useState, useEffect } from "react";
import { Search, Phone, Mail, User, Workflow, Users, MessageSquare, Calendar, Settings, Heart, Star, Target, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3, Church, Cross, Book, Handshake, HeartHandshake, Podcast, Video, UserCheck, Users2, GraduationCap, Baby, TrendingUp, Waves, Fish, Sun, Moon, Navigation, MapPin, Home, Smile, Footprints } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { buildPhoneOrFilter } from "@/lib/phoneSearch";
import type { LucideIcon } from 'lucide-react';

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

interface SearchContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}

interface SearchFlowRow {
  contact_id: string;
  pipelines: {
    name: string;
    icon: string | null;
  } | null;
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
  
  // Icon mapping object - same as in ContactFlowStatus
  const iconMap: { [key: string]: LucideIcon } = {
    'Users': Users,
    'MessageSquare': MessageSquare,
    'Calendar': Calendar,
    'Settings': Settings,
    'Heart': Heart,
    'Star': Star,
    'Target': Target,
    'Zap': Zap,
    'Shield': Shield,
    'Globe': Globe,
    'Briefcase': Briefcase,
    'BookOpen': BookOpen,
    'Music': Music,
    'Coffee': Coffee,
    'Camera': Camera,
    'Gift': Gift,
    'Flame': Flame,
    'Sparkles': Sparkles,
    'Check': Check,
    'Plus': Plus,
    'Puzzle': Puzzle,
    'LayoutDashboard': LayoutDashboard,
    'BarChart3': BarChart3,
    'Church': Church,
    'Cross': Cross,
    'Book': Book,
    'Footprints': Footprints,
    'Handshake': Handshake,
    'HeartHandshake': HeartHandshake,
    'Fish': Fish,
    'Waves': Waves,
    'Sun': Sun,
    'Moon': Moon,
    'Podcast': Podcast,
    'Video': Video,
    'UserCheck': UserCheck,
    'Users2': Users2,
    'GraduationCap': GraduationCap,
    'Baby': Baby,
    'TrendingUp': TrendingUp,
    'Navigation': Navigation,
    'MapPin': MapPin,
    'Home': Home,
    'Smile': Smile
  };

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
          .or((() => {
            const sanitized = searchQuery.replace(/[(),]/g, '').trim();
            const phoneFilter = buildPhoneOrFilter(searchQuery);
            const phonePart = phoneFilter ? `,${phoneFilter}` : '';
            return `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%${phonePart}`;
          })())
          .order('name', { ascending: true })
          .limit(8);

        if (error) throw error;

        const contactRows = (data || []) as SearchContactRow[];
        const contactIds = contactRows.map((contact) => contact.id);
        let flowRows: SearchFlowRow[] = [];

        if (contactIds.length > 0) {
          const { data: flowsData, error: flowsError } = await supabase
            .from('pipeline_contacts')
            .select(`
              contact_id,
              pipelines(
                name,
                icon
              )
            `)
            .in('contact_id', contactIds);

          if (flowsError) {
            console.warn('Flow lookup failed for global search results:', flowsError);
          } else {
            flowRows = (flowsData || []) as SearchFlowRow[];
          }
        }

        // Transform the data to group flows by contact without letting flow lookup hide contacts
        const contactsMap = new Map<string, SearchContact>();
        
        contactRows.forEach((contact) => {
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
        });

        flowRows.forEach((pc) => {
          const existingContact = contactsMap.get(pc.contact_id);
          if (existingContact && pc.pipelines && !existingContact.flows.some(f => f.name === pc.pipelines.name)) {
            existingContact.flows.push({
              name: pc.pipelines.name,
              icon: pc.pipelines.icon || 'Users'
            });
          }
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
    return text;
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
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
                  <AvatarImage src={contact.avatar} />
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
                  {/* Flow icons */}
                  <div className="flex items-center gap-1.5">
                    <TooltipProvider>
                      {contact.flows.slice(0, 3).map((flow, index) => {
                        const IconComponent = iconMap[flow.icon] || Workflow;
                        return (
                          <Tooltip key={index}>
                            <TooltipTrigger asChild>
                              <div>
                                <IconComponent className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{flow.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                    {contact.flows.length > 3 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 ml-1">
                        +{contact.flows.length - 3}
                      </Badge>
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