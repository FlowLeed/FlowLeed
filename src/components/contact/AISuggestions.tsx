import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lightbulb, RefreshCw, AlertCircle, MessageSquare, ArrowRight, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MessageComposerDialog } from './MessageComposerDialog';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Suggestion {
  type: 'follow_up' | 'prayer_check' | 'birthday' | 'next_step' | 'engagement' | 'milestone' | 'stage_action';
  title: string;
  description: string;
  reasoning?: string;
  priority: 'low' | 'medium' | 'high';
  actionText?: string;
  requiresMessage?: boolean;
  messageType?: 'text' | 'email';
  suggestedStageId?: string;
  suggestedStageName?: string;
  pipelineId?: string;
}

interface AISuggestionsProps {
  contactId: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  currentPipelineId?: string;
  currentPipelineName?: string;
  flows?: Array<{ 
    id?: string;
    pipelineContactId: string; 
    pipeline: { id: string; name: string };
    currentStage?: { id: string; name: string };
    assignedToUserId?: string;
  }>;
}

const typeColors = {
  follow_up: { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-900 dark:text-blue-100', subtext: 'text-blue-700 dark:text-blue-300' },
  prayer_check: { bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-900 dark:text-purple-100', subtext: 'text-purple-700 dark:text-purple-300' },
  birthday: { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-900 dark:text-orange-100', subtext: 'text-orange-700 dark:text-orange-300' },
  next_step: { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200 dark:border-green-800', text: 'text-green-900 dark:text-green-100', subtext: 'text-green-700 dark:text-green-300' },
  engagement: { bg: 'bg-indigo-50 dark:bg-indigo-950', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-900 dark:text-indigo-100', subtext: 'text-indigo-700 dark:text-indigo-300' },
  milestone: { bg: 'bg-pink-50 dark:bg-pink-950', border: 'border-pink-200 dark:border-pink-800', text: 'text-pink-900 dark:text-pink-100', subtext: 'text-pink-700 dark:text-pink-300' },
  stage_action: { bg: 'bg-teal-50 dark:bg-teal-950', border: 'border-teal-200 dark:border-teal-800', text: 'text-teal-900 dark:text-teal-100', subtext: 'text-teal-700 dark:text-teal-300' },
};

const priorityVariants = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
} as const;

export const AISuggestions: React.FC<AISuggestionsProps> = ({ 
  contactId,
  contactName,
  contactPhone,
  contactEmail,
  currentPipelineId,
  currentPipelineName,
  flows
}) => {
  const queryClient = useQueryClient();
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [expandedSuggestions, setExpandedSuggestions] = useState<Record<number, boolean>>({});
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'positive' | 'negative'>>({});
  const [dismissalDialogOpen, setDismissalDialogOpen] = useState(false);
  const [dismissalReason, setDismissalReason] = useState("");
  const [dismissingSuggestion, setDismissingSuggestion] = useState<{ suggestion: Suggestion; index: number } | null>(null);

  // Phase 3B: Use React Query with caching
  const { data: suggestions = [], isLoading, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['ai-suggestions', contactId],
    queryFn: async () => {
      const { data, error: functionError } = await supabase.functions.invoke('generate-contact-suggestions', {
        body: { contactId }
      });

      if (functionError) throw functionError;
      
      return (data.suggestions || []) as Suggestion[];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ 
      suggestion, 
      feedbackType, 
      actionTaken,
      notes
    }: { 
      suggestion: Suggestion; 
      feedbackType: 'positive' | 'negative'; 
      actionTaken?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id)
        .single();

      if (!orgMember) throw new Error('Organization not found');

      const { error } = await supabase
        .from('ai_suggestion_feedback')
        .insert({
          contact_id: contactId,
          organization_id: orgMember.organization_id,
          user_id: user!.id,
          suggestion_type: suggestion.type,
          suggestion_title: suggestion.title,
          suggestion_description: suggestion.description,
          feedback_type: feedbackType,
          action_taken: actionTaken,
          notes: notes,
          metadata: { reasoning: suggestion.reasoning }
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Phase 3B: Invalidate cache after feedback
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions', contactId] });
    }
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ pipelineContactId, newStageId, suggestion }: { 
      pipelineContactId: string; 
      newStageId: string;
      suggestion: Suggestion;
    }) => {
      const { error } = await supabase
        .from('pipeline_contacts')
        .update({ stage_id: newStageId })
        .eq('id', pipelineContactId);
      
      if (error) throw error;

      // Track action
      await submitFeedbackMutation.mutateAsync({
        suggestion,
        feedbackType: 'positive',
        actionTaken: 'stage_changed'
      });
    },
    onSuccess: () => {
      // Phase 3B: Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['contact-comprehensive', contactId] });
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions', contactId] });
      toast({ title: 'Stage updated successfully' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error updating stage', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const handleGenerateMessage = async (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    setMessageDialogOpen(true);
    
    // Track action
    await submitFeedbackMutation.mutateAsync({
      suggestion,
      feedbackType: 'positive',
      actionTaken: 'message_generated'
    });
  };

  // Phase 3A: Enhanced feedback handler with dismissal dialog
  const handleFeedback = async (index: number, suggestion: Suggestion, feedbackType: 'positive' | 'negative') => {
    if (feedbackType === 'negative') {
      setDismissingSuggestion({ suggestion, index });
      setDismissalDialogOpen(true);
    } else {
      setFeedbackGiven(prev => ({ ...prev, [index]: feedbackType }));
      await submitFeedbackMutation.mutateAsync({ suggestion, feedbackType });
      toast({
        title: 'Thanks for the feedback!',
        description: 'We\'ll suggest more like this.'
      });
    }
  };

  const handleDismissalSubmit = async () => {
    if (!dismissingSuggestion) return;
    
    const { suggestion, index } = dismissingSuggestion;
    setFeedbackGiven(prev => ({ ...prev, [index]: 'negative' }));
    
    await submitFeedbackMutation.mutateAsync({
      suggestion,
      feedbackType: 'negative',
      actionTaken: 'dismissed',
      notes: dismissalReason
    });
    
    toast({
      title: 'Feedback noted',
      description: 'We\'ll improve future suggestions based on this.'
    });
    
    setDismissalDialogOpen(false);
    setDismissalReason("");
    setDismissingSuggestion(null);
  };

  const handleStageUpdate = (suggestion: Suggestion) => {
    console.log("🎯 handleStageUpdate called", {
      suggestion,
      suggestedStageId: suggestion.suggestedStageId,
      pipelineId: suggestion.pipelineId,
      flows: flows?.map(f => ({ 
        pipelineId: f.pipeline.id, 
        pipelineName: f.pipeline.name,
        pipelineContactId: f.pipelineContactId,
        currentStage: f.currentStage?.name
      }))
    });

    if (!suggestion.pipelineId || !suggestion.suggestedStageId || !flows) {
      console.error("❌ Missing required fields", { 
        pipelineId: suggestion.pipelineId,
        suggestedStageId: suggestion.suggestedStageId,
        hasFlows: !!flows
      });
      toast({ 
        title: 'Error', 
        description: 'Missing stage information',
        variant: 'destructive' 
      });
      return;
    }

    const flow = flows.find(f => f.pipeline.id === suggestion.pipelineId);
    
    console.log("🔍 Flow lookup result", {
      searchingForPipelineId: suggestion.pipelineId,
      foundFlow: flow ? {
        pipelineId: flow.pipeline.id,
        pipelineName: flow.pipeline.name,
        pipelineContactId: flow.pipelineContactId,
        currentStage: flow.currentStage?.name
      } : null,
      availableFlowIds: flows.map(f => f.pipeline.id)
    });
    
    if (!flow) {
      console.error("❌ Flow not found");
      toast({ 
        title: 'Error', 
        description: 'Contact is not in this flow',
        variant: 'destructive' 
      });
      return;
    }

    if (!flow.pipelineContactId) {
      console.error("❌ Missing pipelineContactId", { flow });
      toast({ 
        title: 'Error', 
        description: 'Invalid flow configuration',
        variant: 'destructive' 
      });
      return;
    }

    console.log("✅ Calling updateStageMutation", {
      pipelineContactId: flow.pipelineContactId,
      newStageId: suggestion.suggestedStageId,
      pipelineName: flow.pipeline.name,
      stageName: suggestion.suggestedStageName
    });

    updateStageMutation.mutate({
      pipelineContactId: flow.pipelineContactId,
      newStageId: suggestion.suggestedStageId,
      suggestion
    });
  };

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const minutesAgo = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 60000) : null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Unable to generate suggestions</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              AI Suggestions
            </span>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Lightbulb className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No suggestions available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              AI Suggestions
              {minutesAgo !== null && minutesAgo > 0 && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo / 60)}h ago`}
                </Badge>
              )}
            </span>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => {
              const colors = typeColors[suggestion.type];
              const isExpanded = expandedSuggestions[index];
              const feedback = feedbackGiven[index];
              
              return (
                <Collapsible
                  key={index}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedSuggestions(prev => ({ ...prev, [index]: open }))}
                >
                  <div className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`font-medium ${colors.text}`}>{suggestion.title}</p>
                      <Badge variant={priorityVariants[suggestion.priority]} className="text-xs">
                        {suggestion.priority}
                      </Badge>
                    </div>
                    <p className={`text-sm ${colors.subtext} mb-2`}>{suggestion.description}</p>
                    
                    {suggestion.reasoning && (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className={`text-xs ${colors.subtext} h-6 px-2 mb-2`}>
                          {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                          {isExpanded ? 'Hide' : 'Why?'}
                        </Button>
                      </CollapsibleTrigger>
                    )}
                    
                    <CollapsibleContent>
                      <div className={`text-xs ${colors.subtext} bg-background/50 rounded p-2 mb-2`}>
                        <span className="font-medium">Reason:</span> {suggestion.reasoning}
                      </div>
                    </CollapsibleContent>
                    
                    <div className="flex items-center gap-2 mt-2">
                      {suggestion.type === 'stage_action' && suggestion.suggestedStageId && suggestion.pipelineId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStageUpdate(suggestion)}
                          className="flex-1 gap-2"
                          disabled={updateStageMutation.isPending}
                        >
                          {updateStageMutation.isPending ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Moving...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="h-4 w-4" />
                              {suggestion.actionText || `Move to ${suggestion.suggestedStageName}`}
                            </>
                          )}
                        </Button>
                      )}

                      {suggestion.requiresMessage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateMessage(suggestion)}
                          className="flex-1 gap-2"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Generate Message
                        </Button>
                      )}

                      {!feedback && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => handleFeedback(index, suggestion, 'positive')}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => handleFeedback(index, suggestion, 'negative')}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {feedback && (
                        <Badge variant="outline" className="text-xs">
                          {feedback === 'positive' ? '👍 Helpful' : '👎 Not helpful'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Phase 3A: Dismissal Reason Dialog */}
      <Dialog open={dismissalDialogOpen} onOpenChange={setDismissalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why wasn't this helpful?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Your feedback helps us improve suggestions for your team.
            </p>
            <div className="space-y-2">
              {['Too soon', 'Not relevant', 'Already handled', 'Wrong tone'].map((reason) => (
                <Button
                  key={reason}
                  variant={dismissalReason === reason ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setDismissalReason(reason)}
                >
                  {reason}
                </Button>
              ))}
              <Button
                variant={dismissalReason.startsWith('Other:') ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setDismissalReason('Other: ')}
              >
                Other
              </Button>
            </div>
            {dismissalReason.startsWith('Other:') && (
              <Textarea
                placeholder="Tell us more..."
                value={dismissalReason.replace('Other: ', '')}
                onChange={(e) => setDismissalReason(`Other: ${e.target.value}`)}
                className="mt-2"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDismissalDialogOpen(false);
              setDismissalReason("");
              setDismissingSuggestion(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleDismissalSubmit}
              disabled={!dismissalReason || dismissalReason === 'Other: '}
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedSuggestion && (
        <MessageComposerDialog
          open={messageDialogOpen}
          onOpenChange={setMessageDialogOpen}
          contactId={contactId}
          contactName={contactName || 'Contact'}
          contactPhone={contactPhone}
          suggestionContext={{
            type: selectedSuggestion.type,
            title: selectedSuggestion.title,
            description: selectedSuggestion.description
          }}
          messageType={selectedSuggestion.messageType || 'text'}
          currentPipelineId={currentPipelineId}
        />
      )}
    </>
  );
};