import { Conversation } from "@/types/messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export const ConversationItem = ({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) => {
  const timeAgo = formatDistanceToNow(conversation.lastMessageTime, { addSuffix: true });
  
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50",
        isSelected && "bg-accent"
      )}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarFallback>{getInitials(conversation.contactName)}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-semibold text-sm truncate">{conversation.contactName}</h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
        </div>
        <p className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</p>
      </div>

      {conversation.unreadCount > 0 && (
        <span className="ml-auto flex-shrink-0 h-5 min-w-5 flex items-center justify-center rounded-full px-2 py-0.5 bg-primary text-primary-foreground text-xs">
          {conversation.unreadCount}
        </span>
      )}
    </div>
  );
};
