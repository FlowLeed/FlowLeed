import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

export const AISuggestions: React.FC = () => {
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
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="font-medium text-blue-900">Follow-up Suggested</p>
            <p className="text-sm text-blue-700">It's been 2 weeks since last contact</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="font-medium text-purple-900">Prayer Check-in</p>
            <p className="text-sm text-purple-700">Ask about recent prayer request</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="font-medium text-orange-900">Birthday Coming</p>
            <p className="text-sm text-orange-700">Birthday is next week</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};