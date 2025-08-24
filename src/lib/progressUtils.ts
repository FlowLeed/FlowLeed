import { Pipeline, PipelineStage, Contact } from "@/types/crm";

export interface ContactProgress {
  contactId: string;
  contactName: string;
  currentStage: string;
  isInProgress: boolean;
  progressPercentage: number;
  enteredStartAt?: string;
  completedEndAt?: string;
  daysInProgress?: number;
}

export interface PipelineProgress {
  totalContacts: number;
  contactsInProgress: number;
  contactsCompleted: number;
  averageDaysToComplete?: number;
  progressDetails: ContactProgress[];
}

export function calculateContactProgress(
  contact: Contact,
  currentStage: PipelineStage,
  pipeline: Pipeline,
  pipelineContacts?: any[]
): ContactProgress {
  const stages = pipeline.stages;
  const startStageIndex = stages.findIndex(s => s.is_start_step);
  const endStageIndex = stages.findIndex(s => s.is_end_step);
  const currentStageIndex = stages.findIndex(s => s.id === currentStage.id);
  
  // Get pipeline contact data for this contact
  const pipelineContact = pipelineContacts?.find(pc => pc.contact_id === contact.id);
  
  let progressPercentage = 0;
  let isInProgress = false;
  
  if (startStageIndex !== -1 && endStageIndex !== -1) {
    // Calculate progress between start and end stages
    if (currentStageIndex >= startStageIndex && currentStageIndex <= endStageIndex) {
      isInProgress = currentStageIndex < endStageIndex;
      const totalSteps = endStageIndex - startStageIndex;
      const currentStep = currentStageIndex - startStageIndex;
      progressPercentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
    }
  }
  
  let daysInProgress: number | undefined;
  if (pipelineContact?.entered_start_at) {
    const startDate = new Date(pipelineContact.entered_start_at);
    const endDate = pipelineContact.completed_end_at 
      ? new Date(pipelineContact.completed_end_at)
      : new Date();
    daysInProgress = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  return {
    contactId: contact.id,
    contactName: contact.name,
    currentStage: currentStage.name,
    isInProgress,
    progressPercentage,
    enteredStartAt: pipelineContact?.entered_start_at,
    completedEndAt: pipelineContact?.completed_end_at,
    daysInProgress,
  };
}

export function calculatePipelineProgress(
  pipeline: Pipeline,
  pipelineContacts?: any[]
): PipelineProgress {
  const allContacts: ContactProgress[] = [];
  
  // Calculate progress for each contact
  pipeline.stages.forEach(stage => {
    stage.contacts.forEach(contact => {
      const progress = calculateContactProgress(contact, stage, pipeline, pipelineContacts);
      allContacts.push(progress);
    });
  });
  
  const contactsInProgress = allContacts.filter(c => c.isInProgress).length;
  const contactsCompleted = allContacts.filter(c => c.completedEndAt).length;
  
  // Calculate average days to complete
  const completedContactsWithTime = allContacts.filter(c => 
    c.completedEndAt && c.daysInProgress !== undefined
  );
  const averageDaysToComplete = completedContactsWithTime.length > 0
    ? completedContactsWithTime.reduce((sum, c) => sum + (c.daysInProgress || 0), 0) / completedContactsWithTime.length
    : undefined;
  
  return {
    totalContacts: allContacts.length,
    contactsInProgress,
    contactsCompleted,
    averageDaysToComplete,
    progressDetails: allContacts,
  };
}

export function getProgressColor(percentage: number): string {
  if (percentage >= 80) return "#10B981"; // green
  if (percentage >= 50) return "#F59E0B"; // yellow
  if (percentage >= 20) return "#3B82F6"; // blue
  return "#EF4444"; // red
}