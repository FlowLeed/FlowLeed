
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { PipelineView } from "@/components/crm/PipelineView";
import { hostTeamPipeline, pastoralCarePipeline } from "@/data/mockData";
import { Pipeline } from "@/types/crm";
import { toast } from "sonner";

const PipelinePage = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [pipelines, setPipelines] = useState({
    "host-team": hostTeamPipeline,
    "pastoral-care": pastoralCarePipeline,
  });

  // Determine which pipeline to show based on URL parameter
  const currentPipeline = 
    pipelineId === "pastoral-care" ? pipelines["pastoral-care"] : 
    pipelineId === "host-team" ? pipelines["host-team"] : 
    pipelines["host-team"]; // Default to host-team if no match

  const handlePipelineChange = (updatedPipeline: Pipeline) => {
    setPipelines(prev => ({
      ...prev,
      [pipelineId as string]: updatedPipeline
    }));
  };

  if (!currentPipeline) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Pipeline not found</p>
      </div>
    );
  }

  return <PipelineView pipeline={currentPipeline} onPipelineChange={handlePipelineChange} />;
};

export default PipelinePage;
