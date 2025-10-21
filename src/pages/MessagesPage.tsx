import { useState } from "react";
import { ConversationsList } from "@/components/messages/ConversationsList";
import { MessageThread } from "@/components/messages/MessageThread";
import { getConversations, getMessages, getConversation } from "@/data/mockMessages";
import { MessageSquare } from "lucide-react";

const MessagesPage = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  const conversations = getConversations();
  const selectedConversation = selectedConversationId 
    ? getConversation(selectedConversationId) 
    : null;
  const messages = selectedConversationId 
    ? getMessages(selectedConversationId) 
    : [];

  const handleSendMessage = (content: string) => {
    // TODO: Implement actual message sending in Phase 3
    console.log("Sending message:", content);
    // This will be connected to Supabase and Twilio in later phases
  };

  return (
    <div className="flex h-full">
      {/* Conversations List - Left Panel */}
      <div className="w-72 flex-shrink-0">
        <ConversationsList
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
        />
      </div>

      {/* Message Thread - Right Panel */}
      <div className="flex-1">
        {selectedConversation ? (
          <MessageThread
            conversation={selectedConversation}
            messages={messages}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a conversation to start messaging</p>
            <p className="text-sm mt-2">Choose from your direct messages on the left</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
