import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EngagementBadge } from '@/components/contact/EngagementBadge';
import { useEngagementScore, useContactCheckins } from '@/hooks/useCheckinData';
import { Activity, Calendar, Flame, Clock, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ContactCheckinsCardProps {
  contactId: string;
}

export function ContactCheckinsCard({ contactId }: ContactCheckinsCardProps) {
  const { data: score, isLoading: scoreLoading } = useEngagementScore(contactId);
  const { data: checkinData, isLoading: checkinsLoading } = useContactCheckins(contactId, 10);

  const checkins = checkinData?.checkins || [];
  const hasHousehold = checkinData?.hasHousehold || false;
  const isLoading = scoreLoading || checkinsLoading;

  // Don't render anything if no check-in data exists
  if (!isLoading && !score && checkins.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Attendance
            {hasHousehold && (
              <Badge variant="outline" className="text-[10px] font-normal gap-1">
                <Users className="h-3 w-3" />
                Includes household
              </Badge>
            )}
          </span>
          <EngagementBadge score={score} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        {score && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatItem
              icon={<Activity className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Score"
              value={`${score.score}/100`}
            />
            <StatItem
              icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Last 12 Weeks"
              value={`${score.weeks_attended_last_12} attended`}
            />
            <StatItem
              icon={<Flame className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Streak"
              value={score.streak_weeks > 0 ? `${score.streak_weeks} weeks` : '—'}
            />
            <StatItem
              icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Last Check-in"
              value={score.last_checkin_at
                ? new Date(score.last_checkin_at).toLocaleDateString()
                : '—'}
            />
          </div>
        )}

        {/* Additional metrics */}
        {score && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{score.total_checkins_30d} check-ins (30d)</span>
            <span>·</span>
            <span>{score.total_checkins_90d} check-ins (90d)</span>
            {score.volunteer_checkins_90d > 0 && (
              <>
                <span>·</span>
                <span>{score.volunteer_checkins_90d} volunteer (90d)</span>
              </>
            )}
          </div>
        )}

        {/* Recent Check-ins Table */}
        {checkins.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Check-ins</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Event</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Location</TableHead>
                    {hasHousehold && (
                      <TableHead className="text-xs hidden sm:table-cell">Checked in by</TableHead>
                    )}
                    <TableHead className="text-xs">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkins.map((checkin) => (
                    <TableRow key={checkin.id} className={checkin.is_household ? 'opacity-80' : ''}>
                      <TableCell className="text-xs py-2">
                        <div>
                          <div className="font-medium">{checkin.event_name || 'Unknown Event'}</div>
                          {checkin.event_time_name && (
                            <div className="text-muted-foreground">{checkin.event_time_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground">
                        {checkin.checked_in_at
                          ? new Date(checkin.checked_in_at).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground hidden sm:table-cell">
                        {checkin.location_name || '—'}
                      </TableCell>
                      {hasHousehold && (
                        <TableCell className="text-xs py-2 hidden sm:table-cell">
                          {checkin.is_household ? (
                            <span className="text-muted-foreground italic">{checkin.checked_in_by}</span>
                          ) : (
                            <span className="text-foreground">Self</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-xs py-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            checkin.checkin_kind === 'volunteer'
                              ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {checkin.checkin_kind === 'volunteer' ? 'Volunteer' : 'Regular'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/50">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
