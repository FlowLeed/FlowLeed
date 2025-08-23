
import React from "react";
import { useParams } from "react-router-dom";
import { PipelineView } from "@/components/crm/PipelineView";
import { Pipeline } from "@/types/crm";
import { usePipelineContext } from "@/contexts/PipelineContext";

const PipelinePage = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const { pipelines, updatePipeline } = usePipelineContext();

  // Find the pipeline by its actual ID
  const currentPipeline = pipelineId ? Object.values(pipelines).find(p => p.id === pipelineId) : null;

  const handlePipelineChange = (updatedPipeline: Pipeline) => {
    if (pipelineId) {
      updatePipeline(pipelineId, updatedPipeline);
    }
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
