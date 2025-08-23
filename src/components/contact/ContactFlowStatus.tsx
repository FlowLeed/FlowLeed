import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, Plus, Workflow, Users, MessageSquare, Calendar, Settings, Heart, Star, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Puzzle, LayoutDashboard, BarChart3 } from 'lucide-react';
import { AddToFlowDialog } from './AddToFlowDialog';
import type { LucideIcon } from 'lucide-react';

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
  contactId: string;
}

export const ContactFlowStatus: React.FC<ContactFlowStatusProps> = ({ flows, contactId }) => {
  const [showAddToFlowDialog, setShowAddToFlowDialog] = useState(false);
  const navigate = useNavigate();
  
  // Icon mapping object
  const iconMap: { [key: string]: LucideIcon } = {
    'Users': Users,
    'MessageSquare': MessageSquare,
    'Calendar': Calendar,
    'Settings': Settings,
    'Heart': Heart,
    'Star': Star,
    'Target': Target,
    'Zap': Zap,
    'Shield': Shield,
    'Globe': Globe,
    'Briefcase': Briefcase,
    'BookOpen': BookOpen,
    'Music': Music,
    'Coffee': Coffee,
    'Camera': Camera,
    'Gift': Gift,
    'Flame': Flame,
    'Sparkles': Sparkles,
    'Check': Check,
    'Plus': Plus,
    'Puzzle': Puzzle,
    'LayoutDashboard': LayoutDashboard,
    'BarChart3': BarChart3
  };
  
  const currentPipelineIds = flows.map(flow => flow.pipeline.id);
  
  const handleFlowClick = (pipelineId: string) => {
    navigate(`/pipelines/${pipelineId}`);
  };
  if (flows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Current Flows
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddToFlowDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add to Flow
            </Button>
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
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Current Flows
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddToFlowDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add to Flow
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {flows.map((flow) => (
          <div 
            key={flow.pipeline.id} 
            className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleFlowClick(flow.pipeline.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  if (flow.pipeline.icon && iconMap[flow.pipeline.icon]) {
                    const IconComponent = iconMap[flow.pipeline.icon];
                    return <IconComponent className="h-5 w-5 text-muted-foreground" />;
                  }
                  return <Workflow className="h-5 w-5 text-muted-foreground" />;
                })()}
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
      
      <AddToFlowDialog
        open={showAddToFlowDialog}
        onOpenChange={setShowAddToFlowDialog}
        contactId={contactId}
        currentPipelineIds={currentPipelineIds}
      />
    </Card>
  );
};