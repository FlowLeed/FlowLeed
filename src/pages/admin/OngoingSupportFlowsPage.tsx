import { useState, useEffect } from 'react';
import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { AdminFlowStage } from '@/components/admin/AdminFlowStage';
import { AdminOrganizationCard } from '@/components/admin/AdminOrganizationCard';
import { useOrganizationsData, OrganizationData } from '@/hooks/useOrganizationsData';
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

interface SupportStage {
  id: string;
  name: string;
  color: string;
  organizations: OnboardingOrganization[];
}

// Helper function to calculate days since last activity
const calculateDaysSinceActivity = (lastLogin: string | null, createdAt: string): number => {
  const referenceDate = lastLogin || createdAt;
  const days = Math.floor((Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24));
  return days;
};

// Map organization to card format
const mapOrgToCard = (org: OrganizationData): OnboardingOrganization => {
  return {
    id: org.id,
    name: org.name,
    admin: {
      name: org.admin_name || org.primary_contact_name || 'Unknown Admin',
      email: org.admin_email || org.primary_contact_email || '',
      avatar: undefined
    },
    daysInStage: calculateDaysSinceActivity(org.last_login, org.created_at),
    assignedTo: undefined
  };
};

const SUPPORT_STAGE_CONFIG = [
  { id: 'critical', name: 'Critical Health', color: 'red' },
  { id: 'needs-attention', name: 'Needs Attention', color: 'orange' },
  { id: 'monitoring', name: 'Monitoring', color: 'yellow' },
  { id: 'healthy', name: 'Healthy', color: 'green' }
];

export default function OngoingSupportFlowsPage() {
  const { data: organizations, isLoading } = useOrganizationsData();
  const [stages, setStages] = useState<SupportStage[]>([]);

  // Categorize organizations by health status
  useEffect(() => {
    if (!organizations) return;

    const categorized = SUPPORT_STAGE_CONFIG.map(stageConfig => {
      let filteredOrgs: OrganizationData[] = [];

      if (stageConfig.id === 'critical') {
        // Health score < 40 or no login in 30+ days
        filteredOrgs = organizations.filter(org => 
          (org.health_score !== null && org.health_score < 40) ||
          calculateDaysSinceActivity(org.last_login, org.created_at) > 30
        );
      } else if (stageConfig.id === 'needs-attention') {
        // Health score 40-60 or no login in 14-30 days
        filteredOrgs = organizations.filter(org => 
          (org.health_score !== null && org.health_score >= 40 && org.health_score < 60) ||
          (calculateDaysSinceActivity(org.last_login, org.created_at) >= 14 && 
           calculateDaysSinceActivity(org.last_login, org.created_at) <= 30)
        );
      } else if (stageConfig.id === 'monitoring') {
        // Health score 60-80 or login within last 14 days
        filteredOrgs = organizations.filter(org => 
          (org.health_score !== null && org.health_score >= 60 && org.health_score < 80) &&
          calculateDaysSinceActivity(org.last_login, org.created_at) < 14
        );
      } else if (stageConfig.id === 'healthy') {
        // Health score 80+
        filteredOrgs = organizations.filter(org => 
          org.health_score !== null && org.health_score >= 80
        );
      }

      return {
        id: stageConfig.id,
        name: stageConfig.name,
        color: stageConfig.color,
        organizations: filteredOrgs.map(mapOrgToCard)
      };
    });

    setStages(categorized);
  }, [organizations]);

  const handleDragEnd = (result: DropResult) => {
    // Support flow doesn't need persistence - it's auto-categorized by health
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceStageIndex = stages.findIndex(s => s.id === source.droppableId);
    const destStageIndex = stages.findIndex(s => s.id === destination.droppableId);

    const newStages = [...stages];
    const [movedOrg] = newStages[sourceStageIndex].organizations.splice(source.index, 1);
    newStages[destStageIndex].organizations.splice(destination.index, 0, movedOrg);

    setStages(newStages);
  };

  const handleUpdateStage = (stageId: string, name: string, color: string) => {
    setStages(stages.map(stage => 
      stage.id === stageId ? { ...stage, name, color } : stage
    ));
  };

  const handleAddOrganization = (stageId: string) => {
    console.log('Add organization to stage:', stageId);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <SuperAdminHeader title="Organizations Needing Attention" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Organizations Needing Attention" />
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
