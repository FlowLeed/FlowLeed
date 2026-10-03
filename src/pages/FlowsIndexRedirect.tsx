import { Navigate } from "react-router-dom";
import { useFlowContext } from "@/contexts/FlowContext";
import { Loader2 } from "lucide-react";

/** /flows has no page of its own — send people to their first Flow. */
export default function FlowsIndexRedirect() {
  const { flows, loading } = useFlowContext();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const first = Object.values(flows).sort(
    (a: any, b: any) => (a.flow_order || 0) - (b.flow_order || 0)
  )[0] as any;
  return <Navigate to={first ? `/flows/${first.id}` : "/"} replace />;
}
