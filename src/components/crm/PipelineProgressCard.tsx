import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { Pipeline } from '@/types/crm';
import { calculatePipelineProgress, PipelineProgress } from '@/lib/progressUtils';

interface PipelineProgressCardProps {
  pipeline: Pipeline;
  pipelineContacts?: any[];
}

export function PipelineProgressCard({ pipeline, pipelineContacts }: PipelineProgressCardProps) {
  const progress = calculatePipelineProgress(pipeline, pipelineContacts);
  
  const completionRate = progress.totalContacts > 0 
    ? (progress.contactsCompleted / progress.totalContacts) * 100 
    : 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Pipeline Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{progress.totalContacts}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-3 w-3" />
              Total
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{progress.contactsInProgress}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              In Progress
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{progress.contactsCompleted}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Completed
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Completion Rate</span>
            <span className="text-sm text-muted-foreground">{completionRate.toFixed(1)}%</span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>

        {/* Average Time */}
        {progress.averageDaysToComplete && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Average Time to Complete</span>
            <Badge variant="secondary">
              {Math.round(progress.averageDaysToComplete)} days
            </Badge>
          </div>
        )}

        {/* Stage Progress Indicators */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Stage Distribution</span>
          {pipeline.stages.map(stage => {
            const stageContactCount = stage.contacts.length;
            const stagePercentage = progress.totalContacts > 0 
              ? (stageContactCount / progress.totalContacts) * 100 
              : 0;
            
            return (
              <div key={stage.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: stage.color || '#6B7280' }}
                  />
                  <span>{stage.name}</span>
                  {stage.is_start_step && (
                    <Badge variant="outline" className="text-xs">Start</Badge>
                  )}
                  {stage.is_end_step && (
                    <Badge variant="outline" className="text-xs">End</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{stageContactCount}</span>
                  <span className="text-xs text-muted-foreground">
                    ({stagePercentage.toFixed(0)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}