import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar,
  Edit,
  UserPlus,
  Heart,
  StickyNote,
  Clock
} from 'lucide-react';

interface Contact {
  email?: string;
  phone?: string;
}

interface QuickActionsSidebarProps {
  contact: Contact;
  onEditContact: () => void;
  onAddNote: () => void;
  onAddInteraction: () => void;
  onAddPrayerRequest: () => void;
  onScheduleFollowUp: () => void;
}

export const QuickActionsSidebar: React.FC<QuickActionsSidebarProps> = ({
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
    <div className="space-y-4">
      {/* Contact Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            onClick={handleCall} 
            variant="outline" 
            className="w-full justify-start"
            disabled={!contact.phone}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
          <Button 
            onClick={handleEmail} 
            variant="outline" 
            className="w-full justify-start"
            disabled={!contact.email}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          <Button 
            onClick={handleText} 
            variant="outline" 
            className="w-full justify-start"
            disabled={!contact.phone}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Text
          </Button>
        </CardContent>
      </Card>

      {/* Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            onClick={onEditContact} 
            variant="outline" 
            className="w-full justify-start"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Contact
          </Button>
          <Button 
            onClick={onAddNote} 
            variant="outline" 
            className="w-full justify-start"
          >
            <StickyNote className="h-4 w-4 mr-2" />
            Add Note
          </Button>
          <Button 
            onClick={onAddInteraction} 
            variant="outline" 
            className="w-full justify-start"
          >
            <Clock className="h-4 w-4 mr-2" />
            Log Interaction
          </Button>
          <Button 
            onClick={onAddPrayerRequest} 
            variant="outline" 
            className="w-full justify-start"
          >
            <Heart className="h-4 w-4 mr-2" />
            Add Prayer Request
          </Button>
          <Button 
            onClick={onScheduleFollowUp} 
            variant="outline" 
            className="w-full justify-start"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Follow-up
          </Button>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="p-2 bg-blue-50 rounded text-blue-800">
              <p className="font-medium">Follow-up Suggested</p>
              <p className="text-xs">It's been 2 weeks since last contact</p>
            </div>
            <div className="p-2 bg-purple-50 rounded text-purple-800">
              <p className="font-medium">Prayer Check-in</p>
              <p className="text-xs">Ask about recent prayer request</p>
            </div>
            <div className="p-2 bg-orange-50 rounded text-orange-800">
              <p className="font-medium">Birthday Coming</p>
              <p className="text-xs">Birthday is next week</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};