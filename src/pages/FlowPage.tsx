import React from "react";
import { useParams } from "react-router-dom";
import { FlowView } from "@/components/crm/FlowView";
import { Flow } from "@/types/crm";
import { useFlowContext } from "@/contexts/FlowContext";
import { Loader2 } from "lucide-react";

const FlowPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const { flows, updateFlow, loading } = useFlowContext();

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