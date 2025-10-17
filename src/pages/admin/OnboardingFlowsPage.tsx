import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GitBranch, MoreVertical, MessageCircle, Mail, Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingOrganization {
  id: string;
  name: string;
  adminName: string;
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

// Mock data - will be replaced with real data later
const stages: OnboardingStage[] = [
  {
    id: 'signup',
    name: 'Sign Up',
    color: 'blue',
    organizations: [
      { id: '1', name: 'Grace Community Church', adminName: 'Robert Thomas', daysInStage: 0, assignedTo: { name: 'Noah E.' } },
      { id: '2', name: 'Valley Fellowship', adminName: 'Tim Lopez', daysInStage: 1 },
      { id: '3', name: 'Cornerstone Church', adminName: 'Samantha Lopez', daysInStage: 0 },
      { id: '4', name: 'New Life Center', adminName: 'Ava Green', daysInStage: 2 },
      { id: '5', name: 'Faith Assembly', adminName: 'Jessica Hernandez', daysInStage: 1 },
    ],
  },
  {
    id: 'team-invite',
    name: 'Team Invitation',
    color: 'orange',
    organizations: [
      { id: '6', name: 'Hope Church', adminName: 'Joshua White', daysInStage: 0 },
      { id: '7', name: 'River City Church', adminName: 'Sarah Martinez', daysInStage: 0 },
      { id: '8', name: 'Harvest Fellowship', adminName: 'Benjamin Clark', daysInStage: 1, assignedTo: { name: 'Great A.' } },
    ],
  },
  {
    id: 'pco-integration',
    name: 'PCO Integration',
    color: 'green',
    organizations: [
      { id: '9', name: 'City Church', adminName: 'James Lopez', daysInStage: 0, assignedTo: { name: 'Great A.' } },
      { id: '10', name: 'Bridge Church', adminName: 'Lucy Evans', daysInStage: 0 },
      { id: '11', name: 'Summit Church', adminName: 'Ella Scott', daysInStage: 2 },
      { id: '12', name: 'New Hope Chapel', adminName: 'Michael Johnson', daysInStage: 0 },
      { id: '13', name: 'Living Waters', adminName: 'Emily Davis', daysInStage: 1 },
    ],
  },
  {
    id: 'first-flow',
    name: 'First Flow Created',
    color: 'red',
    organizations: [
      { id: '14', name: 'Promise Center', adminName: 'Daniel Taylor', daysInStage: 0 },
      { id: '15', name: 'Kingdom Church', adminName: 'Mia Turner', daysInStage: 0 },
      { id: '16', name: 'Victory Chapel', adminName: 'Ashley Moore', daysInStage: 1 },
      { id: '17', name: 'Elevation Church', adminName: 'John Smith', daysInStage: 0 },
      { id: '18', name: 'Gateway Fellowship', adminName: 'Ethan Lewis', daysInStage: 2 },
    ],
  },
];

const getStageColor = (color: string) => {
  const colors: Record<string, string> = {
    blue: 'border-blue-500',
    orange: 'border-orange-500',
    green: 'border-green-500',
    red: 'border-red-500',
  };
  return colors[color] || 'border-border';
};

const getColorDot = (color: string) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
  };
  return colors[color] || 'bg-muted';
};

export default function OnboardingFlowsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Onboarding Flow" icon={GitBranch} />
      <div className="flex-1 overflow-auto">
        <div className="h-full p-6">
          {/* Kanban Board */}
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {stages.map((stage) => (
              <div key={stage.id} className="flex-shrink-0 w-[360px]">
                <Card className={`border-t-4 ${getStageColor(stage.color)} h-full flex flex-col`}>
                  {/* Stage Header */}
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getColorDot(stage.color)}`} />
                      <h3 className="font-medium">{stage.name}</h3>
                      <Badge variant="secondary" className="ml-2">
                        {stage.organizations.length}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Organizations Cards */}
                  <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
                    {stage.organizations.map((org) => (
                      <Card key={org.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4 space-y-3">
                          {/* Org Name and Menu */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-purple-100 text-purple-600 font-semibold">
                                  {org.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">{org.adminName}</div>
                                <div className="text-xs text-muted-foreground">
                                  In stage: {org.daysInStage} days
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Assigned To */}
                          <div className="flex items-center justify-between">
                            {org.assignedTo ? (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {org.assignedTo.name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">
                                  {org.assignedTo.name}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6 bg-muted">
                                  <AvatarFallback className="text-xs">?</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">Unassigned</span>
                              </div>
                            )}

                            {/* Action Icons */}
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MessageCircle className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Mail className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Phone className="h-3 w-3" />
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
