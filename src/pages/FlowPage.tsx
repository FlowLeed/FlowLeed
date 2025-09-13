import React from "react";
import { useParams } from "react-router-dom";
import { FlowView } from "@/components/crm/FlowView";
import { Flow } from "@/types/crm";
import { useFlowContext } from "@/contexts/FlowContext";

const FlowPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const { flows, updateFlow } = useFlowContext();

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