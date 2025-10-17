import { useState } from 'react';
import { useOrganizationsData } from '@/hooks/useOrganizationsData';
import { SuperAdminHeader } from '@/components/admin/SuperAdminHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, TrendingUp, DollarSign, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

export default function OrganizationsListPage() {
  const { data: organizations, isLoading } = useOrganizationsData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrgs = organizations?.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.admin_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.admin_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: organizations?.length || 0,
    active: organizations?.filter(o => o.subscription_status === 'active').length || 0,
    trial: organizations?.filter(o => o.subscription_status === 'trial').length || 0,
    totalRevenue: organizations?.reduce((sum, o) => sum + (o.subscription_status === 'active' ? 399 : 0), 0) || 0,
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

  const getHealthColor = (score: number | null) => {
    if (!score) return 'bg-muted';
    if (score >= 70) return 'bg-green-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <SuperAdminHeader title="Organizations" icon={Building2} />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SuperAdminHeader title="Organizations" icon={Building2} />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trial Organizations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trial}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Org ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Flows</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>AI Uses</TableHead>
                <TableHead>Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs?.map((org) => (
                <TableRow key={org.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-xs">
                    {org.id.substring(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">{org.admin_name || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">{org.admin_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{org.plan_tier || 'Trial'}</TableCell>
                  <TableCell>{getStatusBadge(org.subscription_status)}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(org.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {org.last_login ? new Date(org.last_login).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>{org.total_logins_30d || 0}</TableCell>
                  <TableCell>{org.flows_count || 0}</TableCell>
                  <TableCell>{org.active_users || 0}</TableCell>
                  <TableCell>{org.ai_uses_30d || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={org.health_score || 0} 
                        className="w-16 h-2"
                      />
                      <span className="text-xs text-muted-foreground w-8">
                        {org.health_score || 0}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
