import { useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useGroups } from "@/hooks/useGroups";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { GroupCard } from "@/components/groups/GroupCard";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GroupsPage = () => {
  console.log("[GroupsPage] Component rendered");
  
  const { organization } = useProfile();
  console.log("[GroupsPage] Organization:", organization?.id);
  
  const { groups, isLoading } = useGroups(organization?.id);
  console.log("[GroupsPage] Groups:", groups, "Loading:", isLoading);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");

  if (!organization) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-center py-12">
          <p>Loading organization...</p>
        </div>
      </div>
    );
  }

  const filteredGroups = selectedType === "all" 
    ? groups 
    : groups.filter(g => g.group_type === selectedType);

  const groupTypes = [
    { value: "all", label: "All Groups", count: groups.length },
    { value: "small_group", label: "Small Groups", count: groups.filter(g => g.group_type === "small_group").length },
    { value: "serving_team", label: "Serving Teams", count: groups.filter(g => g.group_type === "serving_team").length },
    { value: "class", label: "Classes", count: groups.filter(g => g.group_type === "class").length },
    { value: "ministry", label: "Ministries", count: groups.filter(g => g.group_type === "ministry").length },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
            <p className="text-muted-foreground">
              Manage your small groups, serving teams, and classes
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>

        {/* Group Type Tabs */}
        <Tabs value={selectedType} onValueChange={setSelectedType}>
          <TabsList>
            {groupTypes.map((type) => (
              <TabsTrigger key={type.value} value={type.value}>
                {type.label} ({type.count})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Groups Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first group to get started
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}

        {/* Create Group Dialog */}
        <CreateGroupDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          organizationId={organization?.id}
        />
      </div>
    </div>
  );
};

export default GroupsPage;
