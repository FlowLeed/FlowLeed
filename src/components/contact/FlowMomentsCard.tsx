import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFlowMoments } from "@/hooks/useFlowMoments";
import { Loader2, Sparkles } from "lucide-react";
import { iconMap } from "@/lib/flowIcons";
import { format } from "date-fns";

interface FlowMomentsCardProps {
  contactId: string;
}

export function FlowMomentsCard({ contactId }: FlowMomentsCardProps) {
  const { data: moments, isLoading } = useFlowMoments(contactId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Flow Moments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!moments || moments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Flow Moments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No moments recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Flow Moments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {moments.map((moment) => {
            const IconComponent = moment.flow_moment_types.icon 
              ? iconMap[moment.flow_moment_types.icon] || Sparkles
              : Sparkles;
            
            return (
              <div key={moment.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                <div 
                  className="p-2 rounded-lg shrink-0"
                  style={{ 
                    backgroundColor: moment.flow_moment_types.color 
                      ? `${moment.flow_moment_types.color}20` 
                      : 'hsl(var(--muted))',
                  }}
                >
                  <IconComponent 
                    className="h-4 w-4" 
                    style={{ 
                      color: moment.flow_moment_types.color || 'hsl(var(--muted-foreground))',
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {moment.flow_moment_types.name}
                  </p>
                  {moment.metadata?.pco_field_value && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {moment.metadata.pco_field_label}: {moment.metadata.pco_field_value}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
