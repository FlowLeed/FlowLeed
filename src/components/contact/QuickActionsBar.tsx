import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar,
  Edit,
  StickyNote,
  Clock,
  Heart
} from 'lucide-react';

interface Contact {
  email?: string;
  phone?: string;
}

interface QuickActionsBarProps {
  contact: Contact;
  onEditContact: () => void;
  onAddNote: () => void;
  onAddInteraction: () => void;
  onAddPrayerRequest: () => void;
  onScheduleFollowUp: () => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  contact,
  onEditContact,
  onAddNote,
  onAddInteraction,
  onAddPrayerRequest,
  onScheduleFollowUp
}) => {
  const handleCall = () => {
    if (contact.phone) {
      window.open(`tel:${contact.phone}`);
    }
  };

  const handleEmail = () => {
    if (contact.email) {
      window.open(`mailto:${contact.email}`);
    }
  };

  const handleText = () => {
    if (contact.phone) {
      window.open(`sms:${contact.phone}`);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2">
          {/* Contact Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleCall} 
              variant="outline" 
              size="sm"
              disabled={!contact.phone}
            >
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
            <Button 
              onClick={handleEmail} 
              variant="outline" 
              size="sm"
              disabled={!contact.email}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button 
              onClick={handleText} 
              variant="outline" 
              size="sm"
              disabled={!contact.phone}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Text
            </Button>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-8 bg-border mx-2" />

          {/* Management Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={onEditContact} 
              variant="outline" 
              size="sm"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button 
              onClick={onAddNote} 
              variant="outline" 
              size="sm"
            >
              <StickyNote className="h-4 w-4 mr-2" />
              Add Note
            </Button>
            <Button 
              onClick={onAddInteraction} 
              variant="outline" 
              size="sm"
            >
              <Clock className="h-4 w-4 mr-2" />
              Log Interaction
            </Button>
            <Button 
              onClick={onAddPrayerRequest} 
              variant="outline" 
              size="sm"
            >
              <Heart className="h-4 w-4 mr-2" />
              Prayer Request
            </Button>
            <Button 
              onClick={onScheduleFollowUp} 
              variant="outline" 
              size="sm"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Follow-up
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};