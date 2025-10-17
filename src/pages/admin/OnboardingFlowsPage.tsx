import { useState } from 'react';
import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { AdminFlowStage } from '@/components/admin/AdminFlowStage';
import { AdminOrganizationCard } from '@/components/admin/AdminOrganizationCard';

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

const initialStages: OnboardingStage[] = [
  {
    id: 'new-signup',
    name: 'New Signup',
    color: 'blue',
    organizations: [
      {
        id: '1',
        name: 'Grace Community Church',
        admin: { name: 'John Smith', email: 'john@gcc.org' },
        daysInStage: 2,
        assignedTo: { name: 'Sarah Johnson' }
      },
      {
        id: '2',
        name: 'Riverside Fellowship',
        admin: { name: 'Emily Davis', email: 'emily@riverside.org' },
        daysInStage: 1,
      }
    ]
  },
  {
    id: 'initial-contact',
    name: 'Initial Contact Made',
    color: 'orange',
    organizations: [
      {
        id: '3',
        name: 'Hope Church',
        admin: { name: 'Michael Brown', email: 'michael@hopechurch.org' },
        daysInStage: 5,
        assignedTo: { name: 'Sarah Johnson' }
      }
    ]
  },
  {
    id: 'training-scheduled',
    name: 'Training Scheduled',
    color: 'yellow',
    organizations: [
      {
        id: '4',
        name: 'Faith Baptist',
        admin: { name: 'Lisa Anderson', email: 'lisa@faithbaptist.org' },
        daysInStage: 3,
        assignedTo: { name: 'Mike Wilson' }
      }
    ]
  },
  {
    id: 'active',
    name: 'Active & Onboarded',
    color: 'green',
    organizations: [
      {
        id: '5',
        name: 'Victory Church',
        admin: { name: 'David Lee', email: 'david@victory.org' },
        daysInStage: 45,
        assignedTo: { name: 'Sarah Johnson' }
      }
    ]
  }
];

export default function OnboardingFlowsPage() {
  const [stages, setStages] = useState<OnboardingStage[]>(initialStages);

  const handleDragEnd = (result: DropResult) => {
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

    setStages(newStages);
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
