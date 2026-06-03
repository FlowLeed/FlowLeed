import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFlowAnalytics } from "@/hooks/useAnalytics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { MetricCard } from "./MetricCard";
import { Users, CheckCircle2, Clock, AlertTriangle, TrendingUp, Activity } from "lucide-react";

export const FlowsSection = () => {
  const { data: flows, isLoading } = useFlowAnalytics();
  const navigate = useNavigate();

  const chartData = flows?.map((flow) => ({
    name: flow.name,
    contacts: flow.totalContacts,
  })) || [];

  const getConversionStatus = (rate: number) => {
    if (rate >= 50) return { label: "High", variant: "default" as const };
    if (rate >= 25) return { label: "Medium", variant: "secondary" as const };
    return { label: "Low", variant: "destructive" as const };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  // Aggregate overview metrics across all flows
  const totalActive = flows?.reduce((s, f) => s + f.activePeople, 0) ?? 0;
  const totalCompleted = flows?.reduce((s, f) => s + f.endCount, 0) ?? 0;
  const totalPeople = flows?.reduce((s, f) => s + f.totalContacts, 0) ?? 0;
  const totalStalled = flows?.reduce((s, f) => s + f.peopleStalled, 0) ?? 0;
  const overallCompletion = totalPeople > 0 ? (totalCompleted / totalPeople) * 100 : 0;
  const completionTimes = (flows ?? [])
    .map((f) => f.avgTimeInFlow)
    .filter((v): v is number => typeof v === "number");
  const overallAvgTime =
    completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : null;
  const lifts = (flows ?? [])
    .map((f) => f.engagementLift)
    .filter((v): v is number => typeof v === "number");
  const overallLift =
    lifts.length > 0 ? lifts.reduce((a, b) => a + b, 0) / lifts.length : null;

  const formatLift = (v: number | null) =>
    v === null ? "N/A" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Active in Flows" value={totalActive} icon={Users} />
        <MetricCard title="Completed" value={totalCompleted} icon={CheckCircle2} />
        <MetricCard
          title="Completion %"
          value={`${overallCompletion.toFixed(1)}%`}
          icon={Activity}
        />
        <MetricCard
          title="Avg Time to Complete"
          value={overallAvgTime !== null ? `${overallAvgTime.toFixed(1)}d` : "N/A"}
          icon={Clock}
        />
        <MetricCard
          title="People Stalled"
          value={totalStalled}
          icon={AlertTriangle}
          description="No stage change in 30+ days"
        />
        <MetricCard
          title="Engagement Lift"
          value={formatLift(overallLift)}
          icon={TrendingUp}
          description="Completed avg − Entry avg"
        />
      </div>

      {/* Flow Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Flow Distribution</CardTitle>
          <CardDescription>Number of people per flow</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-sm" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar
                dataKey="contacts"
                fill="hsl(var(--primary))"
                radius={[8, 8, 0, 0]}
                onClick={(data) => {
                  const flow = flows?.find((f) => f.name === data.name);
                  if (flow) navigate(`/flows/${flow.id}`);
                }}
                className="cursor-pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Per-Flow Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Flow Performance</CardTitle>
          <CardDescription>
            Performance metrics for each flow — active people, completion, time, stalls, and engagement lift
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flow</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Completion %</TableHead>
                <TableHead className="text-right">Avg Time (d)</TableHead>
                <TableHead className="text-right">Stalled</TableHead>
                <TableHead className="text-right">Engagement Lift</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows?.map((flow) => {
                const status = getConversionStatus(flow.completionRate);
                return (
                  <TableRow
                    key={flow.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/flows/${flow.id}`)}
                  >
                    <TableCell className="font-light">{flow.name}</TableCell>
                    <TableCell className="text-right">{flow.activePeople ?? 0}</TableCell>
                    <TableCell className="text-right">{flow.endCount ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {(flow.completionRate ?? 0).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {typeof flow.avgTimeInFlow === "number" ? flow.avgTimeInFlow.toFixed(1) : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      {flow.peopleStalled > 0 ? (
                        <span className="text-destructive font-medium">{flow.peopleStalled}</span>
                      ) : (
                        flow.peopleStalled
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {flow.engagementLift === null ? (
                        <span className="text-muted-foreground">N/A</span>
                      ) : (
                        <span
                          className={
                            flow.engagementLift >= 0
                              ? "text-emerald-600 font-medium"
                              : "text-destructive font-medium"
                          }
                        >
                          {formatLift(flow.engagementLift)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {flows?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No flows found
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
