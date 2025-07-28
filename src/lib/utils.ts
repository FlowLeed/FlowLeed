import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Pipeline } from "@/types/crm"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculatePipelineContactCount(pipeline: Pipeline): number {
  return pipeline.stages.reduce((total, stage) => total + stage.contacts.length, 0)
}
