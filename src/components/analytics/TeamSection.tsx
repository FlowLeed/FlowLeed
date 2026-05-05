import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeamPerformance, DateRange } from "@/hooks/useAnalytics";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatDistanceToNow } from "date-fns";

interface TeamSectionProps {
  dateRange: DateRange;
}

export const TeamSection = ({ dateRange }: TeamSectionProps) => {
  const { data: teamPerformance, isLoading } = useTeamPerformance(dateRange);

  const chartData = teamPerformance?.slice(0, 10).map((member) => ({
    name: member.name,
    interactions: member.totalInteractions,
  })) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Performers Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Most Active Team Members</CardTitle>
          <CardDescription>Top 10 members by interaction count</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} className="text-sm" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar dataKey="interactions" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Team Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Activity Summary</CardTitle>
          <CardDescription>Detailed breakdown of team member performance</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead className="text-right">Assigned People</TableHead>
                <TableHead className="text-right">Total Interactions</TableHead>
                <TableHead>Interaction Types</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamPerformance?.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback>
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{member.assignedContacts}</TableCell>
                  <TableCell className="text-right">{member.totalInteractions}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(member.interactionTypes).map(([type, count]) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type.replace("flow_", "").replace(/_/g, " ")}: {count}
                        </Badge>
                      ))}
                      {Object.keys(member.interactionTypes).length === 0 && (
                        <span className="text-sm text-muted-foreground">No interactions</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {teamPerformance?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No team activity found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
