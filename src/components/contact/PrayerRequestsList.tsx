import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Heart, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PrayerRequest {
  id: string;
  title: string;
  description?: string;
  status: string;
  answered_at?: string;
  answer_description?: string;
  created_at: string;
  created_by_name?: string;
}

interface PrayerRequestsListProps {
  prayerRequests: PrayerRequest[];
  onAddPrayerRequest: (title: string, description: string) => void;
  onMarkAnswered: (id: string, answerDescription: string) => void;
}

export const PrayerRequestsList: React.FC<PrayerRequestsListProps> = ({
  prayerRequests,
  onAddPrayerRequest,
  onMarkAnswered
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerDescription, setAnswerDescription] = useState('');

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAddPrayerRequest(newTitle.trim(), newDescription.trim());
      setNewTitle('');
      setNewDescription('');
      setIsAdding(false);
    }
  };

  const handleMarkAnswered = (id: string) => {
    onMarkAnswered(id, answerDescription);
    setAnsweringId(null);
    setAnswerDescription('');
  };

  const activePrayerRequests = prayerRequests.filter(pr => pr.status === 'active');
  const answeredPrayerRequests = prayerRequests.filter(pr => pr.status === 'answered');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Prayer Requests
          </CardTitle>
          <Button 
            onClick={() => setIsAdding(true)} 
            size="sm" 
            variant="outline"
            disabled={isAdding}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Request
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-3">
            <Input
              placeholder="Prayer request title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Details (optional)..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm">
                Add Request
              </Button>
              <Button 
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle('');
                  setNewDescription('');
                }} 
                size="sm" 
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Active Prayer Requests */}
        {activePrayerRequests.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Active Requests</h4>
            {activePrayerRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium">{request.title}</h5>
                    {request.description && (
                      <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Active</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnsweringId(request.id)}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Mark Answered
                    </Button>
                  </div>
                </div>
                
                {answeringId === request.id && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="How was this prayer answered?"
                      value={answerDescription}
                      onChange={(e) => setAnswerDescription(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleMarkAnswered(request.id)}>
                        Mark as Answered
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setAnsweringId(null);
                          setAnswerDescription('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {request.created_by_name && <span>Added by {request.created_by_name}</span>}
                  <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Answered Prayer Requests */}
        {answeredPrayerRequests.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Answered Prayers</h4>
            {answeredPrayerRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-3 space-y-2 bg-green-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium">{request.title}</h5>
                    {request.description && (
                      <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                    )}
                  </div>
                  <Badge className="bg-green-100 text-green-800">Answered</Badge>
                </div>
                
                {request.answer_description && (
                  <div className="bg-white rounded p-2">
                    <p className="text-sm font-medium text-green-800">Answer:</p>
                    <p className="text-sm">{request.answer_description}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Answered {request.answered_at && formatDistanceToNow(new Date(request.answered_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {prayerRequests.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No prayer requests yet
          </p>
        )}
      </CardContent>
    </Card>
  );
};