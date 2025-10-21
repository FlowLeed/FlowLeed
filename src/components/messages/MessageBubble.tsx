import { Message } from "@/types/messages";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const time = format(message.timestamp, "h:mm a");

  return (
    <div
      className={cn(
        "flex w-full mb-4",
        message.isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
          message.isOutgoing
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <span
          className={cn(
            "text-xs block mt-1",
            message.isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {time}
        </span>
      </div>
    </div>
  );
};
