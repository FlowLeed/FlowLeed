import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Note {
  id: string;
  content: string;
  note_type: string;
  is_private: boolean;
  pipeline_id?: string;
  pipeline_name?: string;
  created_at: string;
  created_by_name?: string;
}

interface ContactNotesProps {
  notes: Note[];
  onAddNote: (content: string, noteType: string, isPrivate: boolean) => void;
}

export const ContactNotes: React.FC<ContactNotesProps> = ({
  notes,
  onAddNote
}) => {
  const [isAddingNote, setIsAddingNote] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleAddNote = () => {
    if (newNoteContent.trim()) {
      onAddNote(newNoteContent.trim(), noteType, isPrivate);
      setNewNoteContent('');
      setNoteType('general');
      setIsPrivate(false);
    }
  };

  const sortedNotes = notes.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'prayer':
        return 'bg-purple-100 text-purple-800';
      case 'pastoral':
        return 'bg-blue-100 text-blue-800';
      case 'follow-up':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notes
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAddingNote && (
          <div className="border rounded-lg p-4 space-y-3">
            <Textarea
              placeholder="Enter your note..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex items-center gap-2">
              <select 
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="general">General</option>
                <option value="prayer">Prayer</option>
                <option value="pastoral">Pastoral</option>
                <option value="follow-up">Follow-up</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                Private note
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddNote} size="sm">
                Save Note
              </Button>
              <Button 
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNoteContent('');
                  setNoteType('general');
                  setIsPrivate(false);
                }} 
                size="sm" 
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {sortedNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No notes added yet
          </p>
        ) : (
          <div className="space-y-3">
            {sortedNotes.map((note) => (
              <div key={note.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getNoteTypeColor(note.note_type)}>
                      {note.note_type}
                    </Badge>
                    {note.pipeline_name && (
                      <Badge variant="outline">
                        {note.pipeline_name}
                      </Badge>
                    )}
                    {note.is_private && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Private
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                </div>
                
                <p className="text-sm">{note.content}</p>
                
                {note.created_by_name && (
                  <p className="text-xs text-muted-foreground">
                    by {note.created_by_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};