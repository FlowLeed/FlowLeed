import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Edit, Save, X } from "lucide-react";
import { useFlowResources } from "@/hooks/useFlowResources";
import { ResourcesViewer } from "./resources/ResourcesViewer";
import { ResourcesEditor } from "./resources/ResourcesEditor";
import { Block } from "@/types/resources";
import { Flow } from "@/types/crm";
import { useAuth } from "@/hooks/useAuth";
import { useFlowTeamMembers } from "@/hooks/useFlowTeamMembers";

interface FlowResourcesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flow: Flow;
  organizationId: string;
}

export const FlowResourcesDrawer = ({ 
  open, 
  onOpenChange, 
  flow,
  organizationId 
}: FlowResourcesDrawerProps) => {
  const { user } = useAuth();
  const { resource, isLoading, createResource, updateResource, isCreating, isUpdating } = useFlowResources(flow.id);
  const { teamMembers } = useFlowTeamMembers(flow.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBlocks, setEditedBlocks] = useState<Block[]>([]);

  // Check if user can edit
  const userRole = teamMembers.find(m => m.user_id === user?.id)?.role;
  const canEdit = userRole === 'lead' || userRole === 'manager';

  useEffect(() => {
    if (resource) {
      setEditedBlocks(resource.content || []);
    } else {
      setEditedBlocks([]);
    }
  }, [resource]);

  const handleSave = () => {
    if (resource) {
      updateResource({ resourceId: resource.id, content: editedBlocks });
    } else {
      createResource({ 
        pipelineId: flow.id, 
        organizationId, 
        content: editedBlocks 
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedBlocks(resource?.content || []);
    setIsEditing(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex-1">
            <SheetTitle>{flow.name} - Documentation</SheetTitle>
            <SheetDescription>
              {isEditing 
                ? "Edit your flow documentation and resources"
                : "View documentation and resources for this flow"
              }
            </SheetDescription>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isCreating || isUpdating}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isCreating || isUpdating}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isCreating || isUpdating ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="mt-6">

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading documentation...
            </div>
          ) : isEditing ? (
            <ResourcesEditor blocks={editedBlocks} onChange={setEditedBlocks} />
          ) : (
            <ResourcesViewer blocks={resource?.content || []} />
          )}

          {resource && !isEditing && (
            <div className="mt-8 pt-4 border-t text-xs text-muted-foreground">
              Last updated: {new Date(resource.updated_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
