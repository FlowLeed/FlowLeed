import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Loader2 } from "lucide-react";
import { CallRecord } from "@/hooks/useCalls";
import { useCalls } from "@/hooks/useCalls";

interface CallStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callRecord: CallRecord | null;
  contactName: string;
  contactAvatar?: string;
  contactPhone?: string;
}

export const CallStatusDialog = ({
  open,
  onOpenChange,
  callRecord,
  contactName,
  contactAvatar,
  contactPhone,
}: CallStatusDialogProps) => {
  const { subscribeToCalls, endCall } = useCalls();
  const [localCallStatus, setLocalCallStatus] = useState(callRecord?.status || "queued");
  const [callDuration, setCallDuration] = useState(0);

  // Subscribe to real-time call updates
  useEffect(() => {
    if (!callRecord?.id) return;

    const unsubscribe = subscribeToCalls((updatedCall) => {
      if (updatedCall.id === callRecord.id) {
        setLocalCallStatus(updatedCall.status);

        // Auto-close when completed
        if (updatedCall.status === "completed" || updatedCall.status === "failed") {
          setTimeout(() => onOpenChange(false), 2000);
        }
      }
    });

    return unsubscribe;
  }, [callRecord?.id, subscribeToCalls, onOpenChange]);

  // Call timer for active calls
  useEffect(() => {
    if (localCallStatus !== "in-progress" || !callRecord?.answered_at) {
      setCallDuration(0);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(callRecord.answered_at!);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - start.getTime()) / 1000);
      setCallDuration(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [localCallStatus, callRecord?.answered_at]);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusDisplay = () => {
    switch (localCallStatus) {
      case "queued":
      case "initiated":
        return {
          text: "Initiating call...",
          subtext: "Please wait",
          icon: <Loader2 className="h-5 w-5 animate-spin" />,
          showEndButton: false,
        };
      case "ringing":
        return {
          text: "Ringing...",
          subtext: "Answer your phone to connect to this call",
          icon: <Phone className="h-5 w-5 animate-pulse" />,
          showEndButton: true,
        };
      case "in-progress":
        return {
          text: "Connected",
          subtext: formatDuration(callDuration),
          icon: <Phone className="h-5 w-5 text-green-500" />,
          showEndButton: true,
        };
      case "completed":
        return {
          text: "Call ended",
          subtext: callRecord?.duration ? `Duration: ${formatDuration(callRecord.duration)}` : "",
          icon: <Phone className="h-5 w-5" />,
          showEndButton: false,
        };
      case "failed":
      case "busy":
      case "no-answer":
        return {
          text: "Call failed",
          subtext: localCallStatus === "busy" ? "Line busy" : localCallStatus === "no-answer" ? "No answer" : "Unable to connect",
          icon: <Phone className="h-5 w-5 text-destructive" />,
          showEndButton: false,
        };
      default:
        return {
          text: "Processing...",
          subtext: "",
          icon: <Loader2 className="h-5 w-5 animate-spin" />,
          showEndButton: false,
        };
    }
  };

  const handleEndCall = () => {
    if (!callRecord?.twilio_call_sid) return;
    endCall.mutate(callRecord.twilio_call_sid);
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call in Progress</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          <Avatar className="h-20 w-20">
            {contactAvatar && <AvatarImage src={contactAvatar} />}
            <AvatarFallback>{getInitials(contactName)}</AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h3 className="font-semibold text-lg">{contactName}</h3>
            {contactPhone && (
              <p className="text-sm text-muted-foreground">{contactPhone}</p>
            )}
          </div>

          <div className="flex flex-col items-center space-y-2">
            {statusDisplay.icon}
            <div className="text-center">
              <p className="font-medium">{statusDisplay.text}</p>
              {statusDisplay.subtext && (
                <p className="text-sm text-muted-foreground">{statusDisplay.subtext}</p>
              )}
            </div>
          </div>

          {statusDisplay.showEndButton && (
            <Button
              variant="destructive"
              onClick={handleEndCall}
              disabled={endCall.isPending}
              className="w-full"
            >
              {endCall.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ending...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  End Call
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
