import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlowView } from "@/components/crm/FlowView";
import { Flow } from "@/types/crm";
import { useFlowContext } from "@/contexts/FlowContext";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMemberOnboarding } from "@/hooks/useMemberOnboarding";

const FlowPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { flows, updateFlow, loading, error } = useFlowContext();
  const { user } = useAuth();
  const { updateProgress, progress } = useMemberOnboarding(user?.id);

  // Redirect to dashboard if there's an organization error or no flows available
  useEffect(() => {
    if (error && error.includes("Organization not found")) {
      navigate("/");
    } else if (!loading && Object.keys(flows).length === 0) {
      // If no flows are available, redirect to dashboard
      navigate("/");
    }
  }, [error, navigate, loading, flows]);

  // Mark member onboarding step when any flow is viewed
  useEffect(() => {
    if (user?.id && flowId && !progress.flows_reviewed) {
      updateProgress('flows_reviewed', true);
    }
  }, [user?.id, flowId, progress.flows_reviewed, updateProgress]);

  // Show loading spinner while flows are being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading flow...</p>
        </div>
      </div>
    );
  }

  // Find the flow by its actual ID
  const currentFlow = flowId ? Object.values(flows).find(f => f.id === flowId) : null;

  const handleFlowChange = (updatedFlow: Flow) => {
    if (flowId) {
      updateFlow(flowId, updatedFlow);
    }
  };

  if (!currentFlow) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Flow not found</p>
      </div>
    );
  }

  return <FlowView flow={currentFlow} onFlowChange={handleFlowChange} />;
};

export default FlowPage;