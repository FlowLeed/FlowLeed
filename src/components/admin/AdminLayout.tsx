import { Outlet, Link } from 'react-router-dom';
import { Building2, Users, Activity, Settings, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">FlowLeed Admin</h1>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <nav className="flex items-center gap-1">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin">Dashboard</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/organizations">Organizations</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/impersonation-logs">Logs</Link>
                </Button>
              </nav>
            </div>
            
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to My Organization
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Admin Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
};
