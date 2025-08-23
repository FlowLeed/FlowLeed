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
  Plus
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
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getInteractionColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'call':
      return 'bg-blue-100 text-blue-800';
    case 'email':
      return 'bg-green-100 text-green-800';
    case 'text':
    case 'message':
      return 'bg-purple-100 text-purple-800';
    case 'meeting':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getInteractionColor(interaction.interaction_type)}>
                        {getInteractionIcon(interaction.interaction_type)}
                        <span className="ml-1 capitalize">{interaction.interaction_type}</span>
                      </Badge>
                      {interaction.subject && (
                        <span className="text-sm font-medium">{interaction.subject}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(interaction.completed_at || interaction.created_at), { 
                        addSuffix: true 
                      })}
                    </span>
                  </div>
                  
                  {interaction.details && (
                    <p className="text-sm text-muted-foreground">{interaction.details}</p>
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