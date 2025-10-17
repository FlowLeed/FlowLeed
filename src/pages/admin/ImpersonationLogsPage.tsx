import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ImpersonationLogsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Impersonation Logs</h2>
        <p className="text-muted-foreground">
          Audit trail of all admin impersonation sessions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Impersonation Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Coming in Phase 7: Complete audit log with session details and actions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
