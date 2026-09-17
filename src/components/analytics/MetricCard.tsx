import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  loading?: boolean;
  description?: string;
}

export const MetricCard = ({
  title,
  value,
  icon: Icon,
  loading,
  description,
}: MetricCardProps) => {
  return (
    <Card>
      <CardContent className="relative p-4 sm:p-6 sm:pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
               <p className="text-2xl font-semibold sm:text-3xl">{value}</p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
           <div className="shrink-0 p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-sidebar-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
