import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrganizationsData } from '@/hooks/useOrganizationsData';
import { useHealthScore } from '@/hooks/useHealthScore';
import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import { HealthScoreCard } from '@/components/admin/HealthScoreCard';
import { EditOrganizationDialog } from '@/components/admin/EditOrganizationDialog';
import { OrganizationPhoneNumbers } from '@/components/admin/OrganizationPhoneNumbers';
import { OrgMembersTable } from '@/components/admin/OrgMembersTable';
import { StartImpersonationDialog } from '@/components/admin/StartImpersonationDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Building2, Calendar, Users, TrendingUp, Activity, Zap, RefreshCw, Pencil, UserCog, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function OrganizationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: organizations, isLoading, refetch } = useOrganizationsData();
  const { data: healthScoreData, isLoading: healthScoreLoading, recalculate, isRecalculating } = useHealthScore(id);

  const handleDelete = async () => {
    if (!id || !org) return;
    setIsDeleting(true);
    const { error } = await supabase.rpc('admin_delete_organization', { _org_id: id });
    setIsDeleting(false);
    if (error) {
      toast.error('Failed to delete organization', { description: error.message });
      return;
    }
    toast.success(`Organization "${org.name}" deleted`);
    setDeleteDialogOpen(false);
    navigate('/fl-admin');
  };

  const org = organizations?.find(o => o.id === id);

  // Use admin_user_id from organization data
  const handleImpersonateClick = () => {
    if (!org?.admin_user_id) {
      console.error('Organization has no admin user ID');
      return;
    }
    
    setOwnerUserId(org.admin_user_id);
    setImpersonateDialogOpen(true);
  };

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
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl">{org.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditDialogOpen(true)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleImpersonateClick}
                      className="gap-2"
                    >
                      <UserCog className="h-4 w-4" />
                      Impersonate
                    </Button>
                  </div>
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

          <EditOrganizationDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            organizationId={org.id}
            currentData={{
              name: org.name,
              primary_contact_name: org.admin_name,
              primary_contact_email: org.admin_email,
              primary_contact_phone: null,
            }}
            onSuccess={refetch}
          />

          {ownerUserId && (
            <StartImpersonationDialog
              open={impersonateDialogOpen}
              onOpenChange={setImpersonateDialogOpen}
              organizationId={org.id}
              organizationName={org.name}
              targetUserId={ownerUserId}
            />
          )}

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

          {/* Health Score */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Health Score Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Comprehensive breakdown of organization health
                </p>
              </div>
              <Button
                onClick={() => id && recalculate(id)}
                disabled={isRecalculating}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Calculating...' : 'Recalculate'}
              </Button>
            </div>
            <HealthScoreCard data={healthScoreData} loading={healthScoreLoading} />
          </div>

          {/* Phone Numbers */}
          {org.id && <OrganizationPhoneNumbers organizationId={org.id} />}

          {/* Team Members */}
          {org.id && <OrgMembersTable organizationId={org.id} organizationName={org.name} />}

          {/* Coming Soon Sections */}
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
  );
}
