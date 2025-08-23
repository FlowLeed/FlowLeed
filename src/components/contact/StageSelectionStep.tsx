import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  color?: string;
  stage_order: number;
}

interface StageSelectionStepProps {
  stages: Stage[];
  loading: boolean;
  adding: boolean;
  onSelect: (stage: Stage) => void;
}

export const StageSelectionStep: React.FC<StageSelectionStepProps> = ({
  stages,
  loading,
  adding,
  onSelect
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No stages found in this flow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {stages.map((stage) => (
        <Card
          key={stage.id}
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => !adding && onSelect(stage)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  Step {stage.stage_order}
                </div>
                <h3 className="font-medium">{stage.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: stage.color ? `${stage.color}20` : undefined,
                    color: stage.color || undefined
                  }}
                >
                  {stage.name}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};