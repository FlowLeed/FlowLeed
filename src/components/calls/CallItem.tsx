import { CallRecord } from "@/types/calls";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";

interface CallItemProps {
  call: CallRecord;
  isSelected: boolean;
  onClick: () => void;
}

export const CallItem = ({ call, isSelected, onClick }: CallItemProps) => {
  const timeAgo = formatDistanceToNow(call.timestamp, { addSuffix: true });

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getCallIcon = () => {
    switch (call.callType) {
      case "inbound":
        return (
          <PhoneIncoming
            className={cn(
              "h-4 w-4",
              call.status === "answered" ? "text-green-500" : "text-muted-foreground"
            )}
          />
        );
      case "outbound":
        return (
          <PhoneOutgoing
            className={cn(
              "h-4 w-4",
              call.status === "answered" ? "text-blue-500" : "text-muted-foreground"
            )}
          />
        );
      case "missed":
        return <PhoneMissed className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50",
        isSelected && "bg-accent"
      )}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarFallback>{getInitials(call.contactName)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {getCallIcon()}
          <h4 className="font-semibold text-sm truncate">{call.contactName}</h4>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timeAgo}</span>
          {formatDuration(call.duration) && (
            <>
              <span>•</span>
              <span>{formatDuration(call.duration)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
