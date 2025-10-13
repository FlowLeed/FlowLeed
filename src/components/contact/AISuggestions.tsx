import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lightbulb, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Suggestion {
  type: 'follow_up' | 'prayer_check' | 'birthday' | 'next_step' | 'engagement' | 'milestone';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionText?: string;
}

interface AISuggestionsProps {
  contactId: string;
}

const typeColors = {
  follow_up: { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-900 dark:text-blue-100', subtext: 'text-blue-700 dark:text-blue-300' },
  prayer_check: { bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-900 dark:text-purple-100', subtext: 'text-purple-700 dark:text-purple-300' },
  birthday: { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-900 dark:text-orange-100', subtext: 'text-orange-700 dark:text-orange-300' },
  next_step: { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200 dark:border-green-800', text: 'text-green-900 dark:text-green-100', subtext: 'text-green-700 dark:text-green-300' },
  engagement: { bg: 'bg-indigo-50 dark:bg-indigo-950', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-900 dark:text-indigo-100', subtext: 'text-indigo-700 dark:text-indigo-300' },
  milestone: { bg: 'bg-pink-50 dark:bg-pink-950', border: 'border-pink-200 dark:border-pink-800', text: 'text-pink-900 dark:text-pink-100', subtext: 'text-pink-700 dark:text-pink-300' },
};

const priorityVariants = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
} as const;

export const AISuggestions: React.FC<AISuggestionsProps> = ({ contactId }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-contact-suggestions', {
        body: { contactId }
      });

      if (functionError) throw functionError;
      
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Error fetching AI suggestions:', err);
      setError('Unable to generate suggestions');
      toast({
        title: 'Error generating suggestions',
        description: 'Please try again later',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [contactId]);

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
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSuggestions}>
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
            <Button variant="ghost" size="icon" onClick={fetchSuggestions}>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Suggestions
          </span>
          <Button variant="ghost" size="icon" onClick={fetchSuggestions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => {
            const colors = typeColors[suggestion.type];
            return (
              <div 
                key={index}
                className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={`font-medium ${colors.text}`}>{suggestion.title}</p>
                  <Badge variant={priorityVariants[suggestion.priority]} className="text-xs">
                    {suggestion.priority}
                  </Badge>
                </div>
                <p className={`text-sm ${colors.subtext}`}>{suggestion.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};