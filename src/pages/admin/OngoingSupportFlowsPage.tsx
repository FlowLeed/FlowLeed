import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, MoreVertical, Mail, Phone, Plus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SupportTicket {
  id: string;
  organizationName: string;
  subject: string;
  priority: 'low' | 'medium' | 'high';
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

// Mock data - will be replaced with real data later
const stages: SupportStage[] = [
  {
    id: 'new',
    name: 'New',
    color: 'blue',
    tickets: [
      { id: '1', organizationName: 'Grace Community', subject: 'PCO sync not working', priority: 'high', daysOpen: 0, assignedTo: { name: 'Sarah M.' } },
      { id: '2', organizationName: 'Valley Fellowship', subject: 'Need help with flows', priority: 'medium', daysOpen: 1 },
      { id: '3', organizationName: 'Hope Church', subject: 'Billing question', priority: 'low', daysOpen: 0 },
    ],
  },
  {
    id: 'in-progress',
    name: 'In Progress',
    color: 'orange',
    tickets: [
      { id: '4', organizationName: 'City Church', subject: 'User permissions issue', priority: 'high', daysOpen: 2, assignedTo: { name: 'John D.' } },
      { id: '5', organizationName: 'New Life Center', subject: 'Contact import help', priority: 'medium', daysOpen: 1, assignedTo: { name: 'Sarah M.' } },
      { id: '6', organizationName: 'River City Church', subject: 'Training request', priority: 'low', daysOpen: 3 },
    ],
  },
  {
    id: 'waiting',
    name: 'Waiting on Customer',
    color: 'yellow',
    tickets: [
      { id: '7', organizationName: 'Bridge Church', subject: 'Feature clarification', priority: 'medium', daysOpen: 5, assignedTo: { name: 'John D.' } },
      { id: '8', organizationName: 'Summit Church', subject: 'Integration setup', priority: 'low', daysOpen: 4 },
    ],
  },
  {
    id: 'resolved',
    name: 'Resolved',
    color: 'green',
    tickets: [
      { id: '9', organizationName: 'Promise Center', subject: 'Email notification fixed', priority: 'high', daysOpen: 1, assignedTo: { name: 'Sarah M.' } },
      { id: '10', organizationName: 'Kingdom Church', subject: 'Account setup complete', priority: 'medium', daysOpen: 2, assignedTo: { name: 'John D.' } },
      { id: '11', organizationName: 'Victory Chapel', subject: 'Data export provided', priority: 'low', daysOpen: 1 },
      { id: '12', organizationName: 'Gateway Fellowship', subject: 'Bug fix deployed', priority: 'high', daysOpen: 0, assignedTo: { name: 'Sarah M.' } },
    ],
  },
];

const getStageColor = (color: string) => {
  const colors: Record<string, string> = {
    blue: 'border-blue-400',
    orange: 'border-orange-400',
    yellow: 'border-yellow-400',
    green: 'border-green-400',
  };
  return colors[color] || 'border-border';
};

const getColorDot = (color: string) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-400',
    orange: 'bg-orange-400',
    yellow: 'bg-yellow-400',
    green: 'bg-green-400',
  };
  return colors[color] || 'bg-muted';
};

const getPriorityColor = (priority: string) => {
  const colors: Record<string, 'default' | 'secondary' | 'destructive'> = {
    high: 'destructive',
    medium: 'default',
    low: 'secondary',
  };
  return colors[priority] || 'secondary';
};

export default function OngoingSupportFlowsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Ongoing Support" icon={MessageCircle} />
      <div className="flex-1 overflow-auto">
        <div className="h-full p-6">
          {/* Kanban Board */}
          <div className="flex gap-3 h-full overflow-x-auto pb-4">
            {stages.map((stage) => (
              <div key={stage.id} className="flex-shrink-0 w-[320px]">
                <Card className={`border-l-4 ${getStageColor(stage.color)} h-full flex flex-col shadow-sm`}>
                  {/* Stage Header */}
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getColorDot(stage.color)}`} />
                      <h3 className="font-semibold text-sm">{stage.name}</h3>
                      <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                        {stage.tickets.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Ticket Cards */}
                  <CardContent className="flex-1 overflow-y-auto p-2 space-y-2">
                    {stage.tickets.map((ticket) => (
                      <Card key={ticket.id} className="border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-3 space-y-2">
                          {/* Ticket Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-semibold text-sm">{ticket.organizationName}</div>
                                <Badge variant={getPriorityColor(ticket.priority)} className="text-[10px] px-1.5 py-0">
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {ticket.subject}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                Open: {ticket.daysOpen} days
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Assigned To */}
                          <div className="flex items-center justify-between pt-1 border-t">
                            {ticket.assignedTo ? (
                              <div className="flex items-center gap-1">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback className="text-[9px]">
                                    {ticket.assignedTo.name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[11px] text-muted-foreground">
                                  {ticket.assignedTo.name}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Avatar className="h-4 w-4 bg-muted">
                                  <AvatarFallback className="text-[9px]">?</AvatarFallback>
                                </Avatar>
                                <span className="text-[11px] text-muted-foreground">Unassigned</span>
                              </div>
                            )}

                            {/* Action Icons */}
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100">
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100">
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100">
                                <Phone className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
