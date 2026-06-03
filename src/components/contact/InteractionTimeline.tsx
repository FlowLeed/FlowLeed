import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar,
  Clock,
  Plus,
  GitBranch,
  Users,
  ArrowRight,
  UserCheck,
  UserMinus,
  UserPlus,
  FileText,
  Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Interaction {
  id: string;
  interaction_type: string;
  subject?: string;
  details?: string;
  outcome?: string;
  completed_at?: string;
  scheduled_at?: string;
  created_at: string;
  stage_id?: string;
  previous_stage_id?: string;
  assigned_to_user_id?: string;
  metadata?: any; // Use any to handle Supabase Json type
  pipeline?: {
    name: string;
    id: string;
  };
  stage?: {
    name: string;
    color?: string;
  };
  previous_stage?: {
    name: string;
    color?: string;
  };
}

interface InteractionTimelineProps {
  interactions: Interaction[];
  onAddInteraction: () => void;
}

const getInteractionIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'call':
      return <Phone className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    case 'text':
    case 'message':
      return <MessageSquare className="h-4 w-4" />;
    case 'meeting':
      return <Calendar className="h-4 w-4" />;
    case 'checkin':
      return <UserCheck className="h-4 w-4" />;
    case 'flow_stage_changed':
      return <ArrowRight className="h-4 w-4" />;
    case 'flow_assignment_changed':
      return <UserCheck className="h-4 w-4" />;
    case 'flow_added':
      return <UserPlus className="h-4 w-4" />;
    case 'flow_removed':
      return <UserMinus className="h-4 w-4" />;
    case 'flow_note_added':
      return <GitBranch className="h-4 w-4" />;
    case 'note':
      return <FileText className="h-4 w-4" />;
    case 'prayer_request':
      return <Users className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getInteractionColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'call':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'email':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    case 'text':
    case 'message':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
    case 'meeting':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
    case 'checkin':
      return 'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-300';
    case 'flow_stage_changed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'flow_assignment_changed':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300';
    case 'flow_added':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    case 'flow_removed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    case 'flow_note_added':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300';
    case 'note':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300';
    case 'prayer_request':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const InteractionTimeline: React.FC<InteractionTimelineProps> = ({
  interactions,
  onAddInteraction
}) => {
  const sortedInteractions = interactions.sort((a, b) => 
    new Date(b.completed_at || b.created_at).getTime() - 
    new Date(a.completed_at || a.created_at).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Interaction History
          </CardTitle>
          <Button onClick={onAddInteraction} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Interaction
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedInteractions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No interactions recorded yet
          </p>
        ) : (
          <div className="space-y-4">
            {sortedInteractions.map((interaction) => (
              <div key={interaction.id} className="border-l-2 border-muted pl-4 pb-4 relative">
                <div className="absolute -left-2 top-0 w-4 h-4 bg-background border-2 border-muted rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                    <div className="flex items-start gap-2 min-w-0 flex-wrap">
                      <Badge className={`${getInteractionColor(interaction.interaction_type)} whitespace-nowrap shrink-0`}>
                        {getInteractionIcon(interaction.interaction_type)}
                        <span className="ml-1 capitalize">{interaction.interaction_type.replace(/_/g, ' ')}</span>
                      </Badge>
                      {interaction.subject && (
                        <span className="text-sm font-medium min-w-0 break-words">{interaction.subject}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(interaction.completed_at || interaction.created_at), { 
                        addSuffix: true 
                      })}
                    </span>
                  </div>
                  
                  {interaction.details && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{interaction.details}</p>
                      {interaction.metadata?.ai_generated && (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI-Assisted
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Flow-specific context display */}
                  {(interaction.metadata?.pipeline_name || interaction.pipeline?.name) && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Pipeline: </span>
                      <span>{interaction.metadata?.pipeline_name || interaction.pipeline?.name}</span>
                    </div>
                  )}

                  {/* Stage information for flow activities */}
                  {(interaction.metadata?.stage_name || interaction.metadata?.previous_stage_name || 
                    interaction.stage?.name || interaction.previous_stage?.name) && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {(interaction.metadata?.previous_stage_name || interaction.previous_stage?.name) && (
                        <Badge variant="outline" className="text-xs">
                          {interaction.metadata?.previous_stage_name || interaction.previous_stage?.name}
                        </Badge>
                      )}
                      {(interaction.metadata?.previous_stage_name || interaction.previous_stage?.name) && 
                       (interaction.metadata?.new_stage_name || interaction.stage?.name) && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      {(interaction.metadata?.new_stage_name || interaction.stage?.name) && (
                        <Badge variant="outline" className="text-xs">
                          {interaction.metadata?.new_stage_name || interaction.stage?.name}
                        </Badge>
                      )}
                      {interaction.metadata?.stage_name && !interaction.metadata?.new_stage_name && (
                        <Badge variant="outline" className="text-xs">
                          {interaction.metadata.stage_name}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {interaction.outcome && (
                    <div className="text-sm">
                      <span className="font-medium text-muted-foreground">Outcome: </span>
                      <span>{interaction.outcome}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};