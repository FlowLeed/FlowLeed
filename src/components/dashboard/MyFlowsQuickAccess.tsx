import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { getFlowIcon } from "@/lib/flowIcons";

interface Flow {
  id: string;
  name: string;
  icon?: string;
  myContactsCount: number;
}

interface MyFlowsQuickAccessProps {
  flows: Flow[];
  loading?: boolean;
}

export const MyFlowsQuickAccess = ({ flows, loading }: MyFlowsQuickAccessProps) => {
  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-light mb-4">My Flows</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-light mb-4">My Flows</h2>
        <p className="text-sm text-muted-foreground">
          You're not assigned to any flows yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-light mb-4">My Flows</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {flows.map((flow) => {
          const Icon = flow.icon ? getFlowIcon(flow.icon) : Users;
          return (
            <Link key={flow.id} to={`/flows/${flow.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 bg-muted rounded-md">
                      <Icon className="h-4 w-4 text-sidebar-foreground" />
                    </div>
                    {flow.myContactsCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {flow.myContactsCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium line-clamp-2">{flow.name}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
