import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch, Users, CheckCircle, Clock, TrendingUp } from 'lucide-react';

export default function OnboardingFlowsPage() {
  // Mock data - will be replaced with real data later
  const stats = {
    totalOrgs: 24,
    inProgress: 12,
    completed: 8,
    stalled: 4,
    avgCompletionTime: '5.2 days',
  };

  const onboardingSteps = [
    { name: 'Sign Up', completed: 24, inProgress: 0, avgTime: '0.5 days' },
    { name: 'Team Invitation', completed: 18, inProgress: 6, avgTime: '1.2 days' },
    { name: 'PCO Integration', completed: 14, inProgress: 4, avgTime: '2.1 days' },
    { name: 'First Flow Created', completed: 12, inProgress: 2, avgTime: '3.5 days' },
    { name: 'First Contact Added', completed: 10, inProgress: 2, avgTime: '4.8 days' },
    { name: 'Onboarding Complete', completed: 8, inProgress: 2, avgTime: '5.2 days' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Onboarding Flows" icon={GitBranch} />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Orgs</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOrgs}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.inProgress}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completed}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Stalled</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.stalled}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgCompletionTime}</div>
              </CardContent>
            </Card>
          </div>

          {/* Onboarding Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {onboardingSteps.map((step, index) => {
                  const totalAtStep = step.completed + step.inProgress;
                  const completionRate = totalAtStep > 0 ? (step.completed / totalAtStep) * 100 : 0;
                  
                  return (
                    <div key={step.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-semibold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{step.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Avg time: {step.avgTime}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{step.completed} completed</div>
                          <div className="text-xs text-muted-foreground">
                            {step.inProgress} in progress
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-purple-500 transition-all"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon: Detailed Org List */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detailed breakdown by organization coming soon
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
