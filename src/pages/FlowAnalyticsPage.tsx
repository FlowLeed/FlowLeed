import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { FlowMetricsBar } from "@/components/crm/FlowMetricsBar";
import { useFlowContext } from "@/contexts/FlowContext";

const FlowAnalyticsPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { flows, loading } = useFlowContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentFlow = flowId ? Object.values(flows).find((f) => f.id === flowId) : null;

  if (!currentFlow) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Flow not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={`${currentFlow.name} · Analytics`}
        showFlowIcon
        showAddButton={false}
        showBackButton
        onBackClick={() => navigate(`/flows/${currentFlow.id}`)}
      />
      <div className="flex-1 overflow-auto p-6" style={{ backgroundColor: "#FAFAFA" }}>
        <FlowMetricsBar flowId={currentFlow.id} />
      </div>
    </div>
  );
};

export default FlowAnalyticsPage;
