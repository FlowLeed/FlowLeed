import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  UserCircle,
  Building2,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Users,
  Activity,
  Workflow,
  Link as LinkIcon,
  AlertCircle,
} from 'lucide-react';
import { useOrganizationDetail } from '@/hooks/useOrganizationDetail';
import { HealthScoreBadge } from '@/components/admin/HealthScoreBadge';
import { PlanTierBadge } from '@/components/admin/PlanTierBadge';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { StartImpersonationDialog } from '@/components/admin/StartImpersonationDialog';
import { formatDistanceToNow, format } from 'date-fns';

export default function AdminOrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const { data, isLoading } = useOrganizationDetail(orgId!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold">Organization not found</h3>
      </div>
    );
  }

  const { organization: org, members, pipelines, integrations, activityStats } = data;
  const ownerMember = members.find((m) => m.role === 'owner');
  const ownerProfile = ownerMember?.profiles as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/organizations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">{org.name}</h2>
          <p className="text-muted-foreground">{org.slug}</p>
        </div>
        <Button onClick={() => setImpersonateDialogOpen(true)}>
          <UserCircle className="h-4 w-4 mr-2" />
          Impersonate
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={org.subscription_status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanTierBadge tier={org.plan_tier} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <HealthScoreBadge score={org.health_score || 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {format(new Date(org.created_at), 'MMM d, yyyy')}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="flows">Flows</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Owner</div>
                    <div className="text-sm text-muted-foreground">
                      {ownerProfile?.full_name || 'Unknown'}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Email</div>
                    <div className="text-sm text-muted-foreground">
                      {ownerProfile?.email || org.billing_email || 'Not set'}
                    </div>
                  </div>
                </div>
                {org.primary_contact_phone && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Phone</div>
                        <div className="text-sm text-muted-foreground">
                          {org.primary_contact_phone}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Team Members</span>
                  </div>
                  <Badge variant="secondary">{members.length}</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Flows</span>
                  </div>
                  <Badge variant="secondary">{pipelines.length}</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Integrations</span>
                  </div>
                  <Badge variant="secondary">{integrations.length}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Notes */}
          {org.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Admin Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {org.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <PlanTierBadge tier={org.plan_tier} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={org.subscription_status} />
                </div>
                {org.plan_price && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Price</span>
                      <span className="text-sm font-medium">
                        ${org.plan_price}/mo
                      </span>
                    </div>
                  </>
                )}
                {org.trial_ends_at && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Trial Ends</span>
                      <span className="text-sm font-medium">
                        {format(new Date(org.trial_ends_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Revenue</span>
                  <span className="text-2xl font-bold">
                    ${org.total_revenue || 0}
                  </span>
                </div>
                {org.last_payment_date && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Payment</span>
                      <span className="text-sm font-medium">
                        {format(new Date(org.last_payment_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Stats (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {activityStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity data available</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Total activity records: {activityStats.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Detailed usage charts coming soon
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members ({members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => {
                  const profile = member.profiles as any;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{profile?.full_name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">
                            {profile?.email}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flows Tab */}
        <TabsContent value="flows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flows ({pipelines.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pipelines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No flows created yet</p>
                ) : (
                  pipelines.map((pipeline: any) => (
                    <div
                      key={pipeline.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{pipeline.name}</div>
                        {pipeline.description && (
                          <div className="text-sm text-muted-foreground">
                            {pipeline.description}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {pipeline.pipeline_contacts?.[0]?.count || 0} contacts
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrations ({integrations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {integrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No integrations configured
                  </p>
                ) : (
                  integrations.map((integration: any) => (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium capitalize">
                          {integration.service_name.replace('_', ' ')}
                        </div>
                        {integration.last_sync_at && (
                          <div className="text-sm text-muted-foreground">
                            Last sync:{' '}
                            {formatDistanceToNow(new Date(integration.last_sync_at), {
                              addSuffix: true,
                            })}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={integration.status} />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Impersonation Dialog */}
      <StartImpersonationDialog
        open={impersonateDialogOpen}
        onOpenChange={setImpersonateDialogOpen}
        organizationId={org.id}
        organizationName={org.name}
        adminName={ownerProfile?.full_name || 'Unknown'}
        adminEmail={ownerProfile?.email || org.billing_email || ''}
      />
    </div>
  );
}
