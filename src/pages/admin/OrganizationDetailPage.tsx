import { useParams, useNavigate } from 'react-router-dom';
import { useOrganizationsData } from '@/hooks/useOrganizationsData';
import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, Calendar, Users, TrendingUp, Activity, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrganizationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: organizations, isLoading } = useOrganizationsData();

  const org = organizations?.find(o => o.id === id);

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      trial: 'secondary',
      canceled: 'destructive',
    };
    
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <SuperAdminHeader title="Organization Details" icon={Building2} />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6 space-y-6">
            <Skeleton className="h-32 w-full" />
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <SuperAdminHeader title="Organization Not Found" icon={Building2} />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Organization not found</p>
                <div className="flex justify-center mt-4">
                  <Button onClick={() => navigate('/fl-admin')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Organizations
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Organization Details" icon={Building2} />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Back Button */}
          <Button variant="ghost" onClick={() => navigate('/fl-admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organizations
          </Button>

          {/* Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{org.name}</CardTitle>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Admin:</span>
                      <span>{org.admin_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Email:</span>
                      <span>{org.admin_email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-lg font-semibold">{org.plan_tier || 'Trial'}</div>
                  {getStatusBadge(org.subscription_status)}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Created</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(org.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Last Login</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {org.last_login ? new Date(org.last_login).toLocaleDateString() : 'Never'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {org.total_logins_30d || 0} logins (30d)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{org.active_users || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Flows</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{org.flows_count || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Integration & Sync</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last PCO Sync</span>
                  <span className="text-sm font-medium">
                    {org.last_pco_sync ? new Date(org.last_pco_sync).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Weekly Activity</span>
                  <span className="text-sm font-medium">{org.avg_weekly_activity || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  AI Usage (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total AI Uses</span>
                  <span className="text-sm font-medium">{org.ai_uses_30d || 0}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Includes texts, drafts, and suggestions
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coming Soon Sections */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle>Health Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>

            <Card className="opacity-60">
              <CardHeader>
                <CardTitle>Onboarding Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
