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
    console.log("Loading pipelines from localStorage:", stored);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log("Parsed pipelines:", parsed);
      return parsed;
    }
  } catch (error) {
    console.error("Error loading pipelines from localStorage:", error);
  }
  
  // Return default pipelines if no stored data or error
  const defaultPipelines = {
    "host-team": hostTeamPipeline,
    "pastoral-care": pastoralCarePipeline,
    "operations": operationsPipeline,
    "giving-hub": givingHubPipeline,
  };
  console.log("Using default pipelines:", defaultPipelines);
  return defaultPipelines;
};

export const PipelineProvider: React.FC<PipelineProviderProps> = ({ children }) => {
  const [pipelines, setPipelines] = useState<Record<string, Pipeline>>(getInitialPipelines);

  // Save to localStorage whenever pipelines change
  useEffect(() => {
    try {
      console.log("Saving pipelines to localStorage:", pipelines);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines));
      console.log("Successfully saved to localStorage");
    } catch (error) {
      console.error("Error saving pipelines to localStorage:", error);
    }
  }, [pipelines]);

  const updatePipeline = (pipelineId: string, pipeline: Pipeline) => {
    console.log("Updating pipeline:", pipelineId, pipeline);
    setPipelines(prev => {
      const updated = {
        ...prev,
        [pipelineId]: pipeline
      };
      console.log("New pipelines state:", updated);
      return updated;
    });
  };

  return (
    <PipelineContext.Provider value={{ pipelines, updatePipeline }}>
      {children}
    </PipelineContext.Provider>
  );
};