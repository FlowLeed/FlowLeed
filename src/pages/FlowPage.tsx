import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlowView } from "@/components/crm/FlowView";
import { Flow } from "@/types/crm";
import { useFlowContext } from "@/contexts/FlowContext";
import { Loader2, Settings2, UserPlus, LayoutGrid, Table2, SquareCheck, CheckSquare } from "lucide-react";
import { BaseHeader } from "@/components/layout/header";
import { FlowHeaderFilters } from "@/components/crm/FlowHeaderFilters";
import { useFlowTeamMembers } from "@/hooks/useFlowTeamMembers";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { iconMap } from "@/lib/flowIcons";

const FlowPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { flows, updateFlow, loading, error } = useFlowContext();
  
  // Header state
  const [viewMode, setViewMode] = useState<"kanban" | "table">(() => {
    const saved = localStorage.getItem("flowViewMode");
    return (saved as "kanban" | "table") || "kanban";
  });
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("flowViewMode", viewMode);
  }, [viewMode]);

  // Redirect to dashboard if there's an organization error or no flows available
  useEffect(() => {
    if (error && error.includes("Organization not found")) {
      navigate("/");
    } else if (!loading && Object.keys(flows).length === 0) {
      // If no flows are available, redirect to dashboard
      navigate("/");
    }
  }, [error, navigate, loading, flows]);

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
  
  const { teamMembers } = useFlowTeamMembers(flowId);

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

  // Get contact counts for filters
  const contactCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: Object.values(currentFlow.stages).reduce(
        (acc, stage) => acc + stage.contacts.length,
        0
      ),
      unassigned: 0,
    };

    Object.values(currentFlow.stages).forEach((stage) => {
      stage.contacts.forEach((contact) => {
        if (!contact.assignedTo) {
          counts.unassigned++;
        } else {
          const teamMember = teamMembers.find(
            (m) => m.full_name === contact.assignedTo?.name || m.email === contact.assignedTo?.name
          );
          if (teamMember) {
            counts[teamMember.user_id] = (counts[teamMember.user_id] || 0) + 1;
          }
        }
      });
    });

    return {
      all: counts.all,
      unassigned: counts.unassigned,
      byMember: counts,
    };
  }, [currentFlow, teamMembers]);

  const FlowIcon = currentFlow.icon ? iconMap[currentFlow.icon] : null;

  return (
    <div className="flex flex-col h-full">
      <BaseHeader
        title={currentFlow.name}
        icon={FlowIcon || undefined}
        centerContent={
          <div className="flex items-center gap-4">
            <FlowHeaderFilters
              teamMembers={teamMembers.map((m) => ({
                id: m.user_id,
                name: m.full_name || m.email,
                email: m.email,
                avatar: m.avatar_url || undefined,
              }))}
              selectedFilter={selectedFilter}
              onFilterChange={setSelectedFilter}
              contactCounts={contactCounts}
            />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <Table2 className="h-4 w-4" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant={isSelectMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setIsSelectMode(!isSelectMode)}
            >
              {isSelectMode ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <SquareCheck className="h-4 w-4" />
              )}
            </Button>
          </div>
        }
        customActions={
          <>
            <Button
              onClick={() => setIsAddContactOpen(true)}
              size="sm"
            >
              <UserPlus className="h-4 w-4" />
              New Person
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-hidden">
        <FlowView 
          flow={currentFlow} 
          onFlowChange={handleFlowChange}
          viewMode={viewMode}
          isSelectMode={isSelectMode}
          setIsSelectMode={setIsSelectMode}
          selectedFilter={selectedFilter}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          isAddContactOpen={isAddContactOpen}
          setIsAddContactOpen={setIsAddContactOpen}
        />
      </div>
    </div>
  );
};

export default FlowPage;