import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Pipeline } from "@/types/crm";
import { hostTeamPipeline, pastoralCarePipeline, operationsPipeline, givingHubPipeline } from "@/data/mockData";

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

const STORAGE_KEY = "lovable-pipelines";

const getInitialPipelines = (): Record<string, Pipeline> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading pipelines from localStorage:", error);
  }
  
  // Return default pipelines if no stored data or error
  return {
    "host-team": hostTeamPipeline,
    "pastoral-care": pastoralCarePipeline,
    "operations": operationsPipeline,
    "giving-hub": givingHubPipeline,
  };
};

export const PipelineProvider: React.FC<PipelineProviderProps> = ({ children }) => {
  const [pipelines, setPipelines] = useState<Record<string, Pipeline>>(getInitialPipelines);

  // Save to localStorage whenever pipelines change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines));
    } catch (error) {
      console.error("Error saving pipelines to localStorage:", error);
    }
  }, [pipelines]);

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