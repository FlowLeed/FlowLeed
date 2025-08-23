import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Workflow } from 'lucide-react';

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface FlowSelectionStepProps {
  pipelines: Pipeline[];
  loading: boolean;
  onSelect: (pipeline: Pipeline) => void;
}

export const FlowSelectionStep: React.FC<FlowSelectionStepProps> = ({
  pipelines,
  loading,
  onSelect
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No available flows to add this contact to.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {pipelines.map((pipeline) => (
        <Card
          key={pipeline.id}
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => onSelect(pipeline)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {pipeline.icon ? (
                <span className="text-lg">{pipeline.icon}</span>
              ) : (
                <Workflow className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <h3 className="font-medium">{pipeline.name}</h3>
                {pipeline.description && (
                  <p className="text-sm text-muted-foreground">{pipeline.description}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};