import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Users, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

export default function OngoingSupportFlowsPage() {
  // Mock data - will be replaced with real data later
  const stats = {
    activeTickets: 18,
    avgResponseTime: '2.3 hrs',
    resolvedToday: 12,
    pendingReview: 5,
    satisfaction: '94%',
  };

  const supportCategories = [
    { 
      name: 'Technical Issues', 
      active: 8, 
      resolved: 45, 
      avgTime: '4.2 hrs',
      trend: '+12%'
    },
    { 
      name: 'Feature Requests', 
      active: 4, 
      resolved: 23, 
      avgTime: '6.5 hrs',
      trend: '-5%'
    },
    { 
      name: 'Integration Help', 
      active: 3, 
      resolved: 31, 
      avgTime: '3.8 hrs',
      trend: '+8%'
    },
    { 
      name: 'Account & Billing', 
      active: 2, 
      resolved: 18, 
      avgTime: '2.1 hrs',
      trend: '-3%'
    },
    { 
      name: 'Training & Onboarding', 
      active: 1, 
      resolved: 12, 
      avgTime: '5.5 hrs',
      trend: '+15%'
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Ongoing Support" icon={MessageCircle} />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Tickets</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeTickets}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgResponseTime}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.resolvedToday}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingReview}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.satisfaction}</div>
              </CardContent>
            </Card>
          </div>

          {/* Support Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Support Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {supportCategories.map((category) => (
                  <div key={category.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{category.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Avg resolution: {category.avgTime}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{category.active} active</span>
                          <span className={`text-xs ${category.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                            {category.trend}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {category.resolved} resolved (30d)
                        </div>
                      </div>
                    </div>
                    
                    {/* Visual indicator */}
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-purple-500 transition-all"
                        style={{ width: `${(category.active / (category.active + category.resolved)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle>Recent Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ticket history and timeline coming soon
                </p>
              </CardContent>
            </Card>

            <Card className="opacity-60">
              <CardHeader>
                <CardTitle>Team Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Support team metrics coming soon
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
