import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { ConversationsList } from "@/components/messages/ConversationsList";
import { MessageThread } from "@/components/messages/MessageThread";
import { MessageSquare } from "lucide-react";
import { useMessages } from "@/hooks/useMessages";
import { Message } from "@/types/messages";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

const MessagesPage = () => {
  const [searchParams] = useSearchParams();
  const contactIdFromUrl = searchParams.get('contactId');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { user } = useAuth();
  const { organization } = useProfile();
  const { conversations, messages: smsMessages, conversationsLoading, messagesLoading, sendMessage } = useMessages(selectedConversationId || undefined, organization?.id);

  useEffect(() => {
    if (contactIdFromUrl) {
      setSelectedConversationId(contactIdFromUrl);
    }
  }, [contactIdFromUrl]);
  
  // Fetch contact details if no conversation exists yet
  const { data: directContact } = useQuery({
    queryKey: ['contact', contactIdFromUrl],
    queryFn: async () => {
      if (!contactIdFromUrl) return null;
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, avatar')
        .eq('id', contactIdFromUrl)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!contactIdFromUrl && !conversations.find(c => c.contactId === contactIdFromUrl),
  });
  
  const selectedConversation = selectedConversationId 
    ? conversations.find(c => c.contactId === selectedConversationId) || 
      (directContact ? {
        id: directContact.id,
        contactId: directContact.id,
        contactName: directContact.name,
        contactAvatar: directContact.avatar,
        contactPhone: directContact.phone,
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0,
        isActive: true,
      } : null)
    : null;

  // Transform SMS messages to Message format
  const messages: Message[] = smsMessages.map(sms => ({
    id: sms.id,
    conversationId: sms.contact_id,
    senderId: sms.direction === 'outbound' ? (sms.sent_by_user_id || '') : sms.contact_id,
    senderName: sms.direction === 'outbound' ? 'You' : selectedConversation?.contactName || 'Contact',
    content: sms.body,
    timestamp: new Date(sms.created_at),
    isOutgoing: sms.direction === 'outbound',
    status: sms.status as any,
  }));

  const handleSendMessage = async (content: string) => {
    if (!selectedConversationId) return;
    
    try {
      await sendMessage.mutateAsync({
        contactId: selectedConversationId,
        body: content
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Messages" 
        showFlowIcon={false}
        showAddButton={false}
      />
      <div className="flex flex-1 overflow-y-auto overflow-x-hidden">
        {/* Conversations List - Left Panel */}
        <div className="w-72 flex-shrink-0">
        {conversationsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <ConversationsList
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
          />
        )}
      </div>

      {/* Message Thread - Right Panel */}
      <div className="flex-1">
        {selectedConversation ? (
          messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <MessageThread
              conversation={selectedConversation}
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a conversation to start messaging</p>
            <p className="text-sm mt-2">Choose from your direct messages on the left</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default MessagesPage;
