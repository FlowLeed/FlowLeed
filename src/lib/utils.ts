import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Flow } from "@/types/crm"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateFlowContactCount(flow: Flow | undefined): number {
  if (!flow || !flow.stages) return 0;
  return flow.stages.reduce((total, stage) => total + stage.contacts.length, 0);
}
