import { useState } from 'react';
import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { AdminFlowStage } from '@/components/admin/AdminFlowStage';
import { AdminTicketCard } from '@/components/admin/AdminTicketCard';

interface SupportTicket {
  id: string;
  organizationName: string;
  subject: string;
  priority: "high" | "medium" | "low";
  daysOpen: number;
  assignedTo?: {
    name: string;
    avatar?: string;
  };
}

interface SupportStage {
  id: string;
  name: string;
  color: string;
  tickets: SupportTicket[];
}

const initialStages: SupportStage[] = [
  {
    id: 'new',
    name: 'New',
    color: 'blue',
    tickets: [
      {
        id: '1',
        organizationName: 'Grace Community Church',
        subject: 'Cannot sync Planning Center lists',
        priority: 'high',
        daysOpen: 1,
        assignedTo: { name: 'Sarah Johnson' }
      },
      {
        id: '2',
        organizationName: 'Hope Church',
        subject: 'Question about team permissions',
        priority: 'low',
        daysOpen: 2,
      }
    ]
  },
  {
    id: 'in-progress',
    name: 'In Progress',
    color: 'orange',
    tickets: [
      {
        id: '3',
        organizationName: 'Riverside Fellowship',
        subject: 'Contact import errors',
        priority: 'medium',
        daysOpen: 4,
        assignedTo: { name: 'Mike Wilson' }
      }
    ]
  },
  {
    id: 'waiting',
    name: 'Waiting on Customer',
    color: 'yellow',
    tickets: [
      {
        id: '4',
        organizationName: 'Faith Baptist',
        subject: 'Need billing information updated',
        priority: 'medium',
        daysOpen: 7,
        assignedTo: { name: 'Sarah Johnson' }
      }
    ]
  },
  {
    id: 'resolved',
    name: 'Resolved',
    color: 'green',
    tickets: [
      {
        id: '5',
        organizationName: 'Victory Church',
        subject: 'Flow automation setup help',
        priority: 'low',
        daysOpen: 3,
        assignedTo: { name: 'Mike Wilson' }
      }
    ]
  }
];

export default function OngoingSupportFlowsPage() {
  const [stages, setStages] = useState<SupportStage[]>(initialStages);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceStageIndex = stages.findIndex(s => s.id === source.droppableId);
    const destStageIndex = stages.findIndex(s => s.id === destination.droppableId);

    const newStages = [...stages];
    const [movedTicket] = newStages[sourceStageIndex].tickets.splice(source.index, 1);
    newStages[destStageIndex].tickets.splice(destination.index, 0, movedTicket);

    setStages(newStages);
  };

  const handleUpdateStage = (stageId: string, name: string, color: string) => {
    setStages(stages.map(stage => 
      stage.id === stageId ? { ...stage, name, color } : stage
    ));
  };

  const handleAddTicket = (stageId: string) => {
    console.log('Add ticket to stage:', stageId);
    // TODO: Open dialog to add new ticket
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Ongoing Support Flows" />
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
                  items: stage.tickets
                }}
                onUpdateStage={handleUpdateStage}
                onAddItem={handleAddTicket}
                renderCard={(ticket) => (
                  <AdminTicketCard
                    ticket={ticket}
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
