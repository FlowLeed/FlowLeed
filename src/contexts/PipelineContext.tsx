import React, { createContext, useContext, useState, ReactNode } from "react";
import { Pipeline } from "@/types/crm";
import { hostTeamPipeline, pastoralCarePipeline } from "@/data/mockData";

interface PipelineContextType {
  pipelines: Record<string, Pipeline>;
  updatePipeline: (pipelineId: string, pipeline: Pipeline) => void;
}

const PipelineContext = createContext<PipelineContextType | undefined>(undefined);

export const usePipelineContext = () => {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error("usePipelineContext must be used within a PipelineProvider");
  }
  return context;
};

interface PipelineProviderProps {
  children: ReactNode;
}

export const PipelineProvider: React.FC<PipelineProviderProps> = ({ children }) => {
  const [pipelines, setPipelines] = useState<Record<string, Pipeline>>({
    "host-team": hostTeamPipeline,
    "pastoral-care": pastoralCarePipeline,
  });

  const updatePipeline = (pipelineId: string, pipeline: Pipeline) => {
    setPipelines(prev => ({
      ...prev,
      [pipelineId]: pipeline
    }));
  };

  return (
    <PipelineContext.Provider value={{ pipelines, updatePipeline }}>
      {children}
    </PipelineContext.Provider>
  );
};