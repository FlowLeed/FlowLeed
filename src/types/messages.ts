export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isOutgoing: boolean;
  status?: 'sent' | 'delivered' | 'read';
}

export interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactAvatar?: string;
  contactRole?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isActive?: boolean;
}
