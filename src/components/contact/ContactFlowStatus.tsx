import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Target } from 'lucide-react';

interface Pipeline {
  id: string;
  name: string;
  icon?: string;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
  stage_order: number;
}

interface ContactFlow {
  pipeline: Pipeline;
  currentStage: Stage;
  totalStages: number;
  progressPercentage: number;
}

interface ContactFlowStatusProps {
  flows: ContactFlow[];
}

export const ContactFlowStatus: React.FC<ContactFlowStatusProps> = ({ flows }) => {
  if (flows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Current Flows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active flows</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Current Flows
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {flows.map((flow) => (
          <div key={flow.pipeline.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {flow.pipeline.icon && (
                  <span className="text-lg">{flow.pipeline.icon}</span>
                )}
                <h4 className="font-medium">{flow.pipeline.name}</h4>
              </div>
              <Badge 
                variant="secondary"
                style={{ 
                  backgroundColor: flow.currentStage.color ? `${flow.currentStage.color}20` : undefined,
                  color: flow.currentStage.color || undefined 
                }}
              >
                {flow.currentStage.name}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-muted-foreground">
                  Stage {flow.currentStage.stage_order} of {flow.totalStages}
                </span>
              </div>
              <Progress value={flow.progressPercentage} className="h-2" />
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
              <span>Next: Continue in {flow.pipeline.name}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};