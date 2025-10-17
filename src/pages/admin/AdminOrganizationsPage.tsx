import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, MoreVertical, Eye, UserCircle, Mail } from 'lucide-react';
import { useAdminOrganizations } from '@/hooks/useAdminOrganizations';
import { HealthScoreBadge } from '@/components/admin/HealthScoreBadge';
import { PlanTierBadge } from '@/components/admin/PlanTierBadge';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { StartImpersonationDialog } from '@/components/admin/StartImpersonationDialog';
import { formatDistanceToNow } from 'date-fns';

export default function AdminOrganizationsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);

  const { data: organizations = [], isLoading } = useAdminOrganizations({
    search,
    statusFilter,
    planFilter,
  });

  const handleImpersonate = (org: any) => {
    setSelectedOrg(org);
    setImpersonateDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Organizations</h2>
        <p className="text-muted-foreground">
          Manage all organizations and accounts
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, admin, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>

            {/* Plan Filter */}
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No organizations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Logins (30d)</TableHead>
                    <TableHead className="text-right">Flows</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">AI Uses</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/admin/organizations/${org.id}`}
                          className="hover:underline"
                        >
                          {org.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {org.admin_name || 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {org.admin_email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PlanTierBadge tier={org.plan_tier} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={org.subscription_status} />
                      </TableCell>
                      <TableCell>
                        {new Date(org.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {org.last_login
                          ? formatDistanceToNow(new Date(org.last_login), {
                              addSuffix: true,
                            })
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        {org.total_logins_30d || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {org.flows_count || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {org.active_users || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {org.ai_uses_30d || 0}
                      </TableCell>
                      <TableCell>
                        <HealthScoreBadge score={org.health_score || 0} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/organizations/${org.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleImpersonate(org)}
                            >
                              <UserCircle className="h-4 w-4 mr-2" />
                              Impersonate
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${org.admin_email}`}>
                                <Mail className="h-4 w-4 mr-2" />
                                Email Admin
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impersonation Dialog */}
      {selectedOrg && (
        <StartImpersonationDialog
          open={impersonateDialogOpen}
          onOpenChange={setImpersonateDialogOpen}
          organizationId={selectedOrg.id}
          organizationName={selectedOrg.name}
          adminName={selectedOrg.admin_name || 'Unknown'}
          adminEmail={selectedOrg.admin_email}
        />
      )}
    </div>
  );
}
