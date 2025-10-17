import { useState, useEffect } from 'react';
import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { AdminFlowStage } from '@/components/admin/AdminFlowStage';
import { AdminOrganizationCard } from '@/components/admin/AdminOrganizationCard';
import { useOrganizationsData, OrganizationData } from '@/hooks/useOrganizationsData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface OnboardingOrganization {
  id: string;
  name: string;
  admin: {
    name: string;
    email: string;
    avatar?: string;
  };
  daysInStage: number;
  assignedTo?: {
    name: string;
    avatar?: string;
  };
}

interface OnboardingStage {
  id: string;
  name: string;
  color: string;
  organizations: OnboardingOrganization[];
}

// Helper function to calculate days in stage
const calculateDaysInStage = (stageEnteredAt: string | null, createdAt: string): number => {
  const referenceDate = stageEnteredAt || createdAt;
  const days = Math.floor((Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24));
  return days;
};

// Map organization data to card format
const mapOrgToCard = (org: OrganizationData): OnboardingOrganization => {
  return {
    id: org.id,
    name: org.name,
    admin: {
      name: org.admin_name || org.primary_contact_name || 'Unknown Admin',
      email: org.admin_email || org.primary_contact_email || '',
      avatar: undefined
    },
    daysInStage: calculateDaysInStage(null, org.created_at),
    assignedTo: undefined
  };
};

const STAGE_CONFIG = [
  { id: 'signup', name: 'New Signup', color: 'blue' },
  { id: 'initial-contact', name: 'Initial Contact Made', color: 'orange' },
  { id: 'training-scheduled', name: 'Training Scheduled', color: 'yellow' },
  { id: 'active', name: 'Active & Onboarded', color: 'green' }
];

export default function OnboardingFlowsPage() {
  const { data: organizations, isLoading, refetch } = useOrganizationsData();
  const [stages, setStages] = useState<OnboardingStage[]>([]);
  const { toast } = useToast();

  // Group organizations by stage when data loads
  useEffect(() => {
    if (!organizations) return;

    const grouped = STAGE_CONFIG.map(stageConfig => ({
      id: stageConfig.id,
      name: stageConfig.name,
      color: stageConfig.color,
      organizations: organizations
        .filter(org => {
          const step = org.onboarding_completed ? 'active' : (org.onboarding_step || 'signup');
          return step === stageConfig.id;
        })
        .map(mapOrgToCard)
    }));

    setStages(grouped);
  }, [organizations]);

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceStageIndex = stages.findIndex(s => s.id === source.droppableId);
    const destStageIndex = stages.findIndex(s => s.id === destination.droppableId);

    const newStages = [...stages];
    const [movedOrg] = newStages[sourceStageIndex].organizations.splice(source.index, 1);
    
    // Reset days in stage when moving
    movedOrg.daysInStage = 0;
    
    newStages[destStageIndex].organizations.splice(destination.index, 0, movedOrg);

    // Optimistically update UI
    setStages(newStages);

    // Update database
    const { error } = await supabase
      .from('organizations')
      .update({
        onboarding_step: destination.droppableId,
        onboarding_stage_entered_at: new Date().toISOString(),
        onboarding_completed: destination.droppableId === 'active'
      })
      .eq('id', movedOrg.id);

    if (error) {
      console.error('Failed to update organization stage:', error);
      toast({
        title: 'Error',
        description: 'Failed to update organization stage',
        variant: 'destructive'
      });
      // Revert UI on error
      refetch();
    } else {
      toast({
        title: 'Success',
        description: 'Organization stage updated'
      });
    }
  };

  const handleUpdateStage = (stageId: string, name: string, color: string) => {
    setStages(stages.map(stage => 
      stage.id === stageId ? { ...stage, name, color } : stage
    ));
  };

  const handleAddOrganization = (stageId: string) => {
    console.log('Add organization to stage:', stageId);
    // TODO: Open dialog to add new organization
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <SuperAdminHeader title="Onboarding Flows" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Onboarding Flows" />
      <div className="flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 h-full">
            {stages.map((stage) => (
              <AdminFlowStage
                key={stage.id}
                stage={{
                  id: stage.id,
                  name: stage.name,
                  color: stage.color,
                  items: stage.organizations
                }}
                onUpdateStage={handleUpdateStage}
                onAddItem={handleAddOrganization}
                renderCard={(organization) => (
                  <AdminOrganizationCard
                    organization={organization}
                  />
                )}
              />
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
