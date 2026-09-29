import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useTwilioIntegration } from '@/hooks/useTwilioIntegration';
import { useCalls, CallRecord } from '@/hooks/useCalls';
import { CallStatusDialog } from '@/components/calls/CallStatusDialog';
import { MessagingChannelValues, resolveMessagingChannels } from '@/lib/messagingChannels';
import { MessagingChannelIcon } from '@/components/contact/MessagingChannelLinks';

interface Contact extends MessagingChannelValues {
  id: string;
  name?: string;
  avatar?: string;
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
  const navigate = useNavigate();
  const { shouldUseTwilio } = useTwilioIntegration();
  const { initiateCall, setActiveCallId } = useCalls();
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const messagingChannels = resolveMessagingChannels(contact);

  const handleCall = () => {
    if (!contact.phone) return;
    
    if (shouldUseTwilio) {
      initiateCall.mutate(
        { contactId: contact.id },
        {
          onSuccess: (callData) => {
            setActiveCall(callData);
            setActiveCallId(callData.id);
            setShowCallDialog(true);
          }
        }
      );
    } else {
      window.open(`tel:${contact.phone}`);
    }
  };

  const handleEmail = () => {
    if (contact.email) {
      window.open(`mailto:${contact.email}`);
    }
  };

  const handleText = () => {
    if (!contact.phone) return;
    
    if (shouldUseTwilio) {
      navigate(`/messages?contactId=${contact.id}`);
    } else {
      window.open(`sms:${contact.phone}`);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-2">
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
          {messagingChannels.map((channel) => (
            <Button
              key={channel.key}
              asChild
              variant="outline"
              size="sm"
            >
              <a href={channel.url} target="_blank" rel="noopener noreferrer" title={channel.display}>
                <MessagingChannelIcon channelKey={channel.key} className={`h-4 w-4 mr-2 ${channel.colorClass}`} />
                {channel.label === 'Facebook Messenger' ? 'Messenger' : channel.label}
              </a>
            </Button>
          ))}
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
            Note
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
      </CardContent>

      <CallStatusDialog
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
        callRecord={activeCall}
        contactName={contact.name || 'Unknown'}
        contactAvatar={contact.avatar}
        contactPhone={contact.phone}
      />
    </Card>
  );
};