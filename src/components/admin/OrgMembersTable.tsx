import { useMemo, useState } from 'react';
import { useOrgMembersActivity, type OrgMemberActivity } from '@/hooks/useOrgMembersActivity';
import { useFlowTeamMemberships } from '@/hooks/useFlowTeamMemberships';
import { useOrgFlowsMeta, type FlowMeta } from '@/hooks/useOrgFlowsMeta';
import { FlowIconBadge } from '@/components/search/FlowIconBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, UserCog, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { StartImpersonationDialog } from './StartImpersonationDialog';

interface Props {
  organizationId: string;
  organizationName: string;
}

type SortKey = 'name' | 'role' | 'last_login' | 'logins_30d' | 'contacts_assigned' | 'activity' | 'flows';

function roleLabel(role: string): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'admin': return 'Admin';
    case 'member': return 'Leader';
    default: return role;
  }
}

function engagementBadge(m: OrgMemberActivity) {
  const last = m.last_login ? new Date(m.last_login).getTime() : 0;
  const now = Date.now();
  const days = last ? (now - last) / 86400000 : Infinity;
  const activity = m.notes_30d + m.interactions_30d;
  if (days <= 7 && activity >= 5) return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30">Active</Badge>;
  if (days <= 30) return <Badge variant="secondary">Light</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Dormant</Badge>;
}

function initials(name: string | null, email: string | null) {
  const src = (name || email || '?').trim();
  return src.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?';
}

export function OrgMembersTable({ organizationId, organizationName }: Props) {
  const { data, isLoading } = useOrgMembersActivity(organizationId);
  const [sortKey, setSortKey] = useState<SortKey>('last_login');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [impersonateUserId, setImpersonateUserId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    const arr = [...data];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: number | string = '';
      let bv: number | string = '';
      switch (sortKey) {
        case 'name': av = (a.full_name || a.email || '').toLowerCase(); bv = (b.full_name || b.email || '').toLowerCase(); break;
        case 'role': av = a.role; bv = b.role; break;
        case 'last_login': av = a.last_login ? new Date(a.last_login).getTime() : 0; bv = b.last_login ? new Date(b.last_login).getTime() : 0; break;
        case 'logins_30d': av = a.logins_30d; bv = b.logins_30d; break;
        case 'contacts_assigned': av = a.contacts_assigned; bv = b.contacts_assigned; break;
        case 'activity': av = a.notes_30d + a.interactions_30d; bv = b.notes_30d + b.interactions_30d; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' || key === 'role' ? 'asc' : 'desc'); }
  };

  const SortHeader = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team Members
          {data && <span className="text-sm font-normal text-muted-foreground">({data.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader k="name">Member</SortHeader>
                <SortHeader k="role">Role</SortHeader>
                <SortHeader k="last_login">Last login</SortHeader>
                <SortHeader k="logins_30d" className="text-right">Logins (30d/7d)</SortHeader>
                <SortHeader k="contacts_assigned" className="text-right">Contacts</SortHeader>
                <SortHeader k="activity" className="text-right">Notes / Interactions (30d)</SortHeader>
                <TableHead>Engagement</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                    No members found.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && sorted.map(m => (
                <TableRow key={m.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name || ''} />}
                        <AvatarFallback className="text-xs">{initials(m.full_name, m.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{m.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground truncate">{m.email || '—'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{roleLabel(m.role)}</Badge></TableCell>
                  <TableCell>
                    {m.last_login ? (
                      <div>
                        <div className="text-sm">{formatDistanceToNow(new Date(m.last_login), { addSuffix: true })}</div>
                        <div className="text-xs text-muted-foreground">{new Date(m.last_login).toLocaleString()}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{m.logins_30d}</span>
                    <span className="text-muted-foreground"> / {m.logins_7d}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.contacts_assigned}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.notes_30d} / {m.interactions_30d}
                  </TableCell>
                  <TableCell>{engagementBadge(m)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setImpersonateUserId(m.user_id)} title="Impersonate">
                      <UserCog className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {impersonateUserId && (
        <StartImpersonationDialog
          open={!!impersonateUserId}
          onOpenChange={(o) => !o && setImpersonateUserId(null)}
          organizationId={organizationId}
          organizationName={organizationName}
          targetUserId={impersonateUserId}
        />
      )}
    </Card>
  );
}
