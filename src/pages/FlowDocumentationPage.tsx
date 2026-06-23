import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2, Check } from "lucide-react";
import { useFlowResources } from "@/hooks/useFlowResources";
import { ResourcesEditor } from "@/components/crm/resources/ResourcesEditor";
import { Block } from "@/types/resources";
import { useFlowContext } from "@/contexts/FlowContext";
import { useAuth } from "@/hooks/useAuth";
import { useFlowTeamMembers } from "@/hooks/useFlowTeamMembers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";

const FlowDocumentationPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { flows } = useFlowContext();
  const flow = flowId ? flows[flowId] : null;
  
  const { resource, isLoading, createResource, updateResource } = useFlowResources(flowId || null);
  const { teamMembers, loading: teamMembersLoading } = useFlowTeamMembers(flowId || null);
  
  const [editedBlocks, setEditedBlocks] = useState<Block[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);

  // Fetch user's organization ID and role
  const { data: orgData, isLoading: orgRoleLoading } = useQuery({
    queryKey: ['org-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const organizationId = orgData?.organization_id;
  const orgRole = orgData?.role;

  // Check if user can edit
  const isOrgAdmin = orgRole === 'owner' || orgRole === 'admin';
  const userFlowRole = teamMembers.find(m => m.user_id === user?.id)?.role;
  const isFlowManager = userFlowRole === 'lead' || userFlowRole === 'manager';
  const canEdit = isOrgAdmin || isFlowManager;

  // Initialize blocks from resource
  useEffect(() => {
    if (resource) {
      setEditedBlocks(resource.content || []);
    } else {
      setEditedBlocks([]);
    }
  }, [resource?.id]); // Only re-initialize when resource ID changes

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(editedBlocks) !== JSON.stringify(resource?.content || []);
    setHasUnsavedChanges(hasChanges);
  }, [editedBlocks, resource?.content]);

  // Save to localStorage as draft on every change
  useEffect(() => {
    if (flowId && editedBlocks.length > 0) {
      localStorage.setItem(`flow-doc-draft-${flowId}`, JSON.stringify(editedBlocks));
    }
  }, [editedBlocks, flowId]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (flowId && !resource && !isLoading) {
      const draft = localStorage.getItem(`flow-doc-draft-${flowId}`);
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft);
          setEditedBlocks(parsedDraft);
        } catch (e) {
          console.error('Failed to load draft:', e);
        }
      }
    }
  }, [flowId, resource, isLoading]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!flow || !flowId || isSaving) return;

    setIsSaving(true);

    const onSuccess = () => {
      setIsSaving(false);
      setShowSavedIndicator(true);
      setHasUnsavedChanges(false);
      localStorage.removeItem(`flow-doc-draft-${flowId}`);
      toast.success("Documentation saved successfully");
      
      setTimeout(() => {
        setShowSavedIndicator(false);
      }, 3000);
    };

    const onError = () => {
      setIsSaving(false);
      toast.error("Failed to save documentation");
    };

    if (!organizationId) {
      toast.error("Organization not found");
      setIsSaving(false);
      return;
    }

    if (resource) {
      updateResource(
        { resourceId: resource.id, content: editedBlocks },
        { onSuccess, onError }
      );
    } else {
      createResource(
        { 
          pipelineId: flowId, 
          organizationId, 
          content: editedBlocks 
        },
        { onSuccess, onError }
      );
    }
  }, [flow, flowId, resource, editedBlocks, updateResource, createResource, isSaving]);

  // Keyboard shortcut for save (Cmd/Ctrl + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && canEdit) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, canEdit, handleSave]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }
    navigate(`/flows/${flowId}`);
  };

  if (!flow) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Flow not found</p>
      </div>
    );
  }

  if (isLoading || teamMembersLoading || orgRoleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">You don't have permission to edit this documentation</p>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Flow
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header
        title={flow.name}
        showFlowIcon={false}
        showAddButton={false}
        showBackButton
        onBackClick={handleBack}
        rightContent={
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && !isSaving && !showSavedIndicator && (
              <span className="text-sm text-muted-foreground hidden sm:inline">Unsaved changes</span>
            )}
            {showSavedIndicator && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Saved</span>
              </div>
            )}
            <Button onClick={handleSave} disabled={!hasUnsavedChanges || isSaving} size="sm">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        }
      />


      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <ResourcesEditor blocks={editedBlocks} onChange={setEditedBlocks} />
        </div>
      </div>
    </div>
  );
};

export default FlowDocumentationPage;
