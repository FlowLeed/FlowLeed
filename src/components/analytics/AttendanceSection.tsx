import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrgCheckinStats } from "@/hooks/useCheckinData";
import { useProfile } from "@/hooks/useProfile";
import { Users, UserCheck, Activity, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const LEVEL_COLORS: Record<string, string> = {
  highly_engaged: '#22c55e',
  active: '#3b82f6',
  at_risk: '#f59e0b',
  inactive: '#ef4444',
  new: '#94a3b8',
};

const DEFAULT_LEVEL_LABELS: Record<string, string> = {
  highly_engaged: 'Highly Engaged',
  active: 'Active',
  at_risk: 'At Risk',
  inactive: 'Inactive',
  new: 'New',
};

interface AttendanceSectionProps {
  campusId?: string | null;
}

export function AttendanceSection({ campusId }: AttendanceSectionProps) {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const { data: stats, isLoading } = useOrgCheckinStats(orgId, campusId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No check-in data available. Sync check-ins from Planning Center to see attendance analytics.
        </CardContent>
      </Card>
    );
  }

  const pieData = Object.entries(stats.engagementDistribution).map(([level, count]) => ({
    name: engagementLabels[level as keyof typeof engagementLabels] || DEFAULT_LEVEL_LABELS[level] || level,
    value: count,
    color: LEVEL_COLORS[level] || '#94a3b8',
  }));

  const totalEngaged = Object.entries(stats.engagementDistribution)
    .filter(([level]) => level === 'highly_engaged' || level === 'active')
    .reduce((sum, [, count]) => sum + count, 0);

  const totalScored = Object.values(stats.engagementDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Check-ins This Week</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.checkinsThisWeek}</div>
            <p className="text-xs text-muted-foreground">Total check-ins across all events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Check-ins This Month</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.checkinsThisMonth}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engaged Contacts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalScored > 0 ? `${Math.round((totalEngaged / totalScored) * 100)}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalEngaged} of {totalScored} scored contacts are active or highly engaged
            </p>
          </CardContent>
        </Card>
      </div>

      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Engagement Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, 'Contacts']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
