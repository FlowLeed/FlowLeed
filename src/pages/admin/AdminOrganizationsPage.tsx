import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminOrganizationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Organizations</h2>
        <p className="text-muted-foreground">
          Manage all organizations and accounts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations List</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Coming in Phase 3: Organizations table with search, filters, and impersonation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
