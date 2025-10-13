import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Suggestion {
  tone: 'professional' | 'friendly' | 'concise';
  description: string;
  wordCount: number;
}

interface AIDescriptionSuggestionsProps {
  flowName: string;
  stages: Array<{ name: string }>;
  currentDescription?: string;
  onSelect: (description: string) => void;
}

const toneColors = {
  professional: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  friendly: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  concise: 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
};

export const AIDescriptionSuggestions = ({ 
  flowName, 
  stages, 
  currentDescription,
  onSelect 
}: AIDescriptionSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const generateSuggestions = async () => {
    setIsLoading(true);
    setShowSuggestions(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-flow-description', {
        body: { 
          flowName,
          flowStages: stages,
          currentDescription: currentDescription || ""
        }
      });

      if (error) {
        console.error('Error generating suggestions:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to generate AI suggestions",
          variant: "destructive",
        });
        return;
      }

      if (data?.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
        setShowSuggestions(true);
        toast({
          title: "Success",
          description: `Generated ${data.suggestions.length} description options`,
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to generate suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generateSuggestions}
        disabled={!flowName || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Get AI Suggestions
          </>
        )}
      </Button>

      {showSuggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Select a description to use:</p>
          {suggestions.map((suggestion, index) => (
            <Card key={index} className="p-3 hover:bg-accent/50 transition-colors">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={toneColors[suggestion.tone]}
                    >
                      {suggestion.tone.charAt(0).toUpperCase() + suggestion.tone.slice(1)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {suggestion.wordCount} words
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{suggestion.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelect(suggestion.description);
                    setShowSuggestions(false);
                    toast({
                      title: "Description applied",
                      description: "You can still edit the description as needed.",
                    });
                  }}
                  className="shrink-0"
                >
                  Use
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
