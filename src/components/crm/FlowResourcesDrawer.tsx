import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Edit, Check, Loader2 } from "lucide-react";
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const savedIndicatorTimeoutRef = useRef<NodeJS.Timeout>();

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

  // Auto-save with debouncing
  useEffect(() => {
    if (!isEditing) return;

    // Don't auto-save if content hasn't changed from saved version
    const hasChanges = JSON.stringify(editedBlocks) !== JSON.stringify(resource?.content || []);
    if (!hasChanges) return;

    // Clear any existing timeouts
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (savedIndicatorTimeoutRef.current) {
      clearTimeout(savedIndicatorTimeoutRef.current);
    }

    // Set status to saving (will show after debounce)
    setSaveStatus('idle');

    // Debounce: wait 2 seconds after last change before saving
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saving');
      
      if (resource) {
        updateResource(
          { resourceId: resource.id, content: editedBlocks },
          {
            onSuccess: () => {
              setSaveStatus('saved');
              savedIndicatorTimeoutRef.current = setTimeout(() => {
                setSaveStatus('idle');
              }, 2000);
            },
            onError: () => {
              setSaveStatus('idle');
            }
          }
        );
      } else {
        createResource(
          { 
            pipelineId: flow.id, 
            organizationId, 
            content: editedBlocks 
          },
          {
            onSuccess: () => {
              setSaveStatus('saved');
              savedIndicatorTimeoutRef.current = setTimeout(() => {
                setSaveStatus('idle');
              }, 2000);
            },
            onError: () => {
              setSaveStatus('idle');
            }
          }
        );
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current);
      }
    };
  }, [editedBlocks, isEditing, resource, organizationId, flow.id, updateResource, createResource]);


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="flex-row items-center justify-between space-y-0 pb-6">
          <div className="flex-1">
            <SheetTitle className="text-2xl font-bold">{flow.name} - Documentation</SheetTitle>
            <SheetDescription className="text-sm">
              {isEditing 
                ? "Edit your flow documentation and resources"
                : "View documentation and resources for this flow"
              }
            </SheetDescription>
          </div>
          <div className="flex items-center gap-3">
            {isEditing && saveStatus !== 'idle' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-green-600">Saved</span>
                  </>
                )}
              </div>
            )}
            {canEdit && !isEditing && (
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
            {canEdit && isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
              >
                Done
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="max-w-3xl mx-auto px-8 py-6">
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
