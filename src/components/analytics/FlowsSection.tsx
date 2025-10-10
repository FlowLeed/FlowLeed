import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFlowAnalytics } from "@/hooks/useAnalytics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

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
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Flow Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Flow Distribution</CardTitle>
          <CardDescription>Number of contacts per flow</CardDescription>
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

      {/* Flow Conversion Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Flow Conversion Rates</CardTitle>
          <CardDescription>Track how contacts progress from start to end</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flow Name</TableHead>
                <TableHead className="text-right">Total Contacts</TableHead>
                <TableHead className="text-right">Start Step</TableHead>
                <TableHead className="text-right">End Step</TableHead>
                <TableHead className="text-right">Conversion Rate</TableHead>
                <TableHead className="text-right">Avg. Time (days)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows?.map((flow) => {
                const status = getConversionStatus(flow.conversionRate);
                return (
                  <TableRow
                    key={flow.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/flows/${flow.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {flow.icon && <span>{flow.icon}</span>}
                        {flow.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{flow.totalContacts}</TableCell>
                    <TableCell className="text-right">{flow.startCount}</TableCell>
                    <TableCell className="text-right">{flow.endCount}</TableCell>
                    <TableCell className="text-right">
                      {flow.conversionRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {flow.avgTimeInFlow ? flow.avgTimeInFlow.toFixed(1) : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {flows?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
