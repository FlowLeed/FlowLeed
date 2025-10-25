import { useEffect, useRef } from "react";
import { Conversation, Message } from "@/types/messages";
import { ContactHeader } from "./ContactHeader";
import { MessageBubble } from "./MessageBubble";
import { DateDivider } from "./DateDivider";
import { MessageInput } from "./MessageInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare } from "lucide-react";
import { isSameDay } from "date-fns";

interface MessageThreadProps {
  conversation: Conversation;
  messages: Message[];
  onSendMessage: (content: string) => void;
}

export const MessageThread = ({
  conversation,
  messages,
  onSendMessage,
}: MessageThreadProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Group messages by date
  const groupedMessages: { date: Date; messages: Message[] }[] = [];
  messages.forEach((message) => {
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && isSameDay(lastGroup.date, message.timestamp)) {
      lastGroup.messages.push(message);
    } else {
      groupedMessages.push({
        date: message.timestamp,
        messages: [message],
      });
    }
  });

  return (
    <div className="flex flex-col h-full">
      <ContactHeader conversation={conversation} />
      
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-2">
                <MessageSquare className="h-12 w-12 mx-auto opacity-30" />
                <p className="text-sm">Start your conversation with {conversation.contactName}</p>
              </div>
            </div>
          ) : (
            groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                <DateDivider date={group.date} />
                {group.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
};
