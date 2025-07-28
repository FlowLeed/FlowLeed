
import React from "react";
import { useParams } from "react-router-dom";
import { PipelineView } from "@/components/crm/PipelineView";
import { Pipeline } from "@/types/crm";
import { usePipelineContext } from "@/contexts/PipelineContext";

const PipelinePage = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const { pipelines, updatePipeline } = usePipelineContext();

  // Determine which pipeline to show based on URL parameter
  const currentPipeline = pipelines[pipelineId || "host-team"];

  const handlePipelineChange = (updatedPipeline: Pipeline) => {
    updatePipeline(pipelineId as string, updatedPipeline);
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
