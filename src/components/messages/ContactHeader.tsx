import { useState } from "react";
import { Conversation } from "@/types/messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, Video, MoreVertical } from "lucide-react";
import { useTwilioIntegration } from "@/hooks/useTwilioIntegration";
import { useCalls, CallRecord } from "@/hooks/useCalls";
import { CallStatusDialog } from "@/components/calls/CallStatusDialog";

interface ContactHeaderProps {
  conversation: Conversation;
}

export const ContactHeader = ({ conversation }: ContactHeaderProps) => {
  const { shouldUseTwilio } = useTwilioIntegration();
  const { initiateCall, setActiveCallId } = useCalls();
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleCall = () => {
    if (shouldUseTwilio) {
      initiateCall.mutate(
        { contactId: conversation.contactId },
        {
          onSuccess: (callData) => {
            setActiveCall(callData);
            setActiveCallId(callData.id);
            setShowCallDialog(true);
          }
        }
      );
    } else if (conversation.contactPhone) {
      window.open(`tel:${conversation.contactPhone}`);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{getInitials(conversation.contactName)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-semibold text-lg">{conversation.contactName}</h2>
          {conversation.contactRole && (
            <p className="text-sm text-muted-foreground">{conversation.contactRole}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          title="Call"
          onClick={handleCall}
        >
          <Phone className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" title="Video call">
          <Video className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" title="More options">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      <CallStatusDialog
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
        callRecord={activeCall}
        contactName={conversation.contactName}
        contactAvatar={conversation.contactAvatar}
        contactPhone={conversation.contactPhone}
      />
    </div>
  );
};
