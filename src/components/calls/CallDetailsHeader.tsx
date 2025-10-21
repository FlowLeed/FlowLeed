import { CallRecord } from "@/types/calls";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CallDetailsHeaderProps {
  call: CallRecord;
}

export const CallDetailsHeader = ({ call }: CallDetailsHeaderProps) => {
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleViewMessages = () => {
    navigate("/messages");
  };

  const handleNewCall = () => {
    // TODO: Implement click-to-call functionality in later phase
    console.log("Initiating call to:", call.contactName);
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{getInitials(call.contactName)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-semibold text-lg">{call.contactName}</h2>
          {call.contactRole && (
            <p className="text-sm text-muted-foreground">{call.contactRole}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleNewCall} size="sm">
          <Phone className="h-4 w-4 mr-2" />
          New Call
        </Button>
        <Button onClick={handleViewMessages} variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          View Messages
        </Button>
      </div>
    </div>
  );
};
