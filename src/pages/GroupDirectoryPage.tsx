import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, MapPin, Calendar, Clock, Search, Filter, X } from "lucide-react";
import { GroupAvatar } from "@/components/groups/GroupAvatar";
interface PublicGroup {
  id: string;
  name: string;
  description: string | null;
  group_type: string;
  meeting_day: string | null;
  meeting_time: string | null;
  meeting_frequency: string | null;
  location: string | null;
  capacity: number | null;
  public_signup_token: string | null;
  allow_public_signup: boolean;
  member_count: number;
  image_url: string | null;
}

const groupTypeLabels: Record<string, string> = {
  small_group: "Small Group",
  bible_study: "Bible Study",
  ministry_team: "Ministry Team",
  class: "Class",
  support_group: "Support Group",
  other: "Other",
};

const groupTypeColors: Record<string, string> = {
  small_group: "bg-primary/10 text-primary",
  bible_study: "bg-blue-500/10 text-blue-600",
  ministry_team: "bg-green-500/10 text-green-600",
  class: "bg-purple-500/10 text-purple-600",
  support_group: "bg-orange-500/10 text-orange-600",
  other: "bg-muted text-muted-foreground",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function GroupDirectoryPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");

  const { data: groups, isLoading } = useQuery({
    queryKey: ["public-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select(`
          id,
          name,
          description,
          group_type,
          meeting_day,
          meeting_time,
          meeting_frequency,
          location,
          capacity,
          public_signup_token,
          allow_public_signup,
          image_url,
          member_count:group_members(count)
        `)
        .eq("visibility", "public")
        .eq("status", "active")
        .is("archived_at", null)
        .order("name");

      if (error) throw error;

      return data.map((group) => ({
        ...group,
        member_count: group.member_count?.[0]?.count || 0,
      })) as PublicGroup[];
    },
  });

  const filteredGroups = groups?.filter((group) => {
    const matchesSearch =
      !searchQuery ||
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || group.group_type === selectedType;
    const matchesDay = selectedDay === "all" || group.meeting_day === selectedDay;
    return matchesSearch && matchesType && matchesDay;
  });

  const groupTypes = groups
    ? [...new Set(groups.map((g) => g.group_type))]
    : [];

  const activeFilterCount =
    (selectedType !== "all" ? 1 : 0) + (selectedDay !== "all" ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setSelectedType("all");
    setSelectedDay("all");
  };

  const handleJoinGroup = (token: string | null) => {
    if (token) {
      navigate(`/groups/join/${token}`);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Find Your Community</h1>
          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
            Join a group and connect with others. Whether you're looking for fellowship,
            study, or service opportunities, there's a place for you.
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="max-w-6xl mx-auto px-4 -mt-8">
        <Card className="shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-10">
                    <Filter className="h-4 w-4" />
                    Filter
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 rounded-full px-2 py-0 text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Group type</label>
                      <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          {groupTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {groupTypeLabels[type] || type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Meeting day</label>
                      <Select value={selectedDay} onValueChange={setSelectedDay}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All days</SelectItem>
                          {DAYS.map((day) => (
                            <SelectItem key={day} value={day}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                        <X className="mr-2 h-4 w-4" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full mb-4" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredGroups && filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((group) => (
              <Card key={group.id} className="flex flex-col hover:shadow-md transition-shadow overflow-hidden">
                {/* Wide image/avatar at top */}
                <div className="w-full aspect-video bg-muted flex items-center justify-center overflow-hidden">
                  {group.image_url ? (
                    <img 
                      src={group.image_url} 
                      alt={group.name} 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl font-semibold text-muted-foreground">
                      {group.name.trim().split(/\s+/).length >= 2
                        ? (group.name.trim().split(/\s+/)[0][0] + group.name.trim().split(/\s+/)[1][0]).toUpperCase()
                        : group.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">{group.name}</CardTitle>
                    <Badge className={groupTypeColors[group.group_type] || groupTypeColors.other}>
                      {groupTypeLabels[group.group_type] || group.group_type}
                    </Badge>
                  </div>
                  {group.description && (
                    <CardDescription className="line-clamp-2">
                      {group.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2 text-sm text-muted-foreground">
                    {group.meeting_day && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {group.meeting_day}
                          {group.meeting_frequency && ` (${group.meeting_frequency})`}
                        </span>
                      </div>
                    )}
                    {group.meeting_time && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{group.meeting_time}</span>
                      </div>
                    )}
                    {group.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{group.location}</span>
                      </div>
                    )}
                  </div>
                  {group.public_signup_token ? (
                    <Button
                      onClick={() => handleJoinGroup(group.public_signup_token)}
                      className="w-full group"
                    >
                      Learn More
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Contact church to join
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="max-w-md mx-auto text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Groups Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "No groups are currently accepting new members"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
