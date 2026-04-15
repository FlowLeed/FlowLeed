import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare } from "lucide-react";
import { type ChatConversationSummary } from "@/hooks/useChatHistory";

interface ChatHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: ChatConversationSummary[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  activeConversationId: string | null;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  open,
  onOpenChange,
  conversations,
  isLoading,
  onSelect,
  onDelete,
  activeConversationId,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="text-base">Chat History</SheetTitle>
        </SheetHeader>
        <div className="overflow-auto h-[calc(100%-60px)] px-2 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p className="text-sm">No previous conversations</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-start gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent/50 ${
                    conv.id === activeConversationId ? "bg-accent" : ""
                  }`}
                  onClick={() => {
                    onSelect(conv.id);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {conv.title || conv.first_message || "Untitled"}
                    </p>
                    {conv.title && conv.first_message && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.first_message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeAgo(conv.updated_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
