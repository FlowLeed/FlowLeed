import { Conversation, Message } from "@/types/messages";

export const mockConversations: Conversation[] = [
  {
    id: "conv-1",
    contactId: "contact-1",
    contactName: "Sarah Johnson",
    contactAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    contactRole: "First-time Visitor",
    lastMessage: "Thanks so much for reaching out!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    unreadCount: 2,
  },
  {
    id: "conv-2",
    contactId: "contact-2",
    contactName: "Michael Chen",
    contactAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
    contactRole: "Regular Attendee",
    lastMessage: "I'll be there on Sunday!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    unreadCount: 0,
  },
  {
    id: "conv-3",
    contactId: "contact-3",
    contactName: "Emily Rodriguez",
    contactAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
    contactRole: "Volunteer",
    lastMessage: "What time should I arrive?",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    unreadCount: 1,
  },
  {
    id: "conv-4",
    contactId: "contact-4",
    contactName: "David Kim",
    contactAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
    contactRole: "Small Group Leader",
    lastMessage: "Perfect, see you then!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    unreadCount: 0,
  },
  {
    id: "conv-5",
    contactId: "contact-5",
    contactName: "Jessica Martinez",
    contactAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica",
    contactRole: "Youth Ministry",
    lastMessage: "Can we reschedule?",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    unreadCount: 3,
  },
  {
    id: "conv-6",
    contactId: "contact-6",
    contactName: "James Wilson",
    contactAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
    contactRole: "Prayer Partner",
    lastMessage: "Praying for you today",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    unreadCount: 0,
  },
  {
    id: "conv-7",
    contactId: "contact-7",
    contactName: "Amanda Brown",
    contactAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amanda",
    contactRole: "New Member",
    lastMessage: "Thank you for the warm welcome!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    unreadCount: 0,
  },
  {
    id: "conv-8",
    contactId: "contact-8",
    contactName: "Robert Taylor",
    contactAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Robert",
    contactRole: "Mission Trip Participant",
    lastMessage: "Looking forward to it!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
    unreadCount: 0,
  },
];

export const mockMessages: Record<string, Message[]> = {
  "conv-1": [
    {
      id: "msg-1-1",
      conversationId: "conv-1",
      senderId: "current-user",
      senderName: "You",
      content: "Hi Sarah! Welcome to our church. We noticed you visited last Sunday. How was your experience?",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
      isOutgoing: true,
      status: "read",
    },
    {
      id: "msg-1-2",
      conversationId: "conv-1",
      senderId: "contact-1",
      senderName: "Sarah Johnson",
      content: "Hi! It was wonderful. Everyone was so welcoming and the message really spoke to me.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      isOutgoing: false,
    },
    {
      id: "msg-1-3",
      conversationId: "conv-1",
      senderId: "current-user",
      senderName: "You",
      content: "That's great to hear! Would you be interested in joining one of our small groups? We have several that meet throughout the week.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      isOutgoing: true,
      status: "read",
    },
    {
      id: "msg-1-4",
      conversationId: "conv-1",
      senderId: "contact-1",
      senderName: "Sarah Johnson",
      content: "Yes, I'd love that! What days do they meet?",
      timestamp: new Date(Date.now() - 1000 * 60 * 10),
      isOutgoing: false,
    },
    {
      id: "msg-1-5",
      conversationId: "conv-1",
      senderId: "current-user",
      senderName: "You",
      content: "We have groups on Tuesday, Wednesday, and Thursday evenings. I'll send you more details!",
      timestamp: new Date(Date.now() - 1000 * 60 * 8),
      isOutgoing: true,
      status: "delivered",
    },
    {
      id: "msg-1-6",
      conversationId: "conv-1",
      senderId: "contact-1",
      senderName: "Sarah Johnson",
      content: "Thanks so much for reaching out!",
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      isOutgoing: false,
    },
  ],
  "conv-2": [
    {
      id: "msg-2-1",
      conversationId: "conv-2",
      senderId: "current-user",
      senderName: "You",
      content: "Hey Michael! Hope you're doing well. Will we see you at the worship night this Sunday?",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
      isOutgoing: true,
      status: "read",
    },
    {
      id: "msg-2-2",
      conversationId: "conv-2",
      senderId: "contact-2",
      senderName: "Michael Chen",
      content: "I'll be there on Sunday!",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      isOutgoing: false,
    },
  ],
  "conv-3": [
    {
      id: "msg-3-1",
      conversationId: "conv-3",
      senderId: "current-user",
      senderName: "You",
      content: "Hi Emily! Thanks for volunteering for the kids ministry event next week.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      isOutgoing: true,
      status: "read",
    },
    {
      id: "msg-3-2",
      conversationId: "conv-3",
      senderId: "contact-3",
      senderName: "Emily Rodriguez",
      content: "What time should I arrive?",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      isOutgoing: false,
    },
  ],
  "conv-4": [
    {
      id: "msg-4-1",
      conversationId: "conv-4",
      senderId: "current-user",
      senderName: "You",
      content: "David, can we meet to discuss the small group curriculum for next month?",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 10),
      isOutgoing: true,
      status: "read",
    },
    {
      id: "msg-4-2",
      conversationId: "conv-4",
      senderId: "contact-4",
      senderName: "David Kim",
      content: "Sure! How about Thursday at 2pm?",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 7),
      isOutgoing: false,
    },
    {
      id: "msg-4-3",
      conversationId: "conv-4",
      senderId: "current-user",
      senderName: "You",
      content: "Perfect, see you then!",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
      isOutgoing: true,
      status: "read",
    },
  ],
  "conv-5": [
    {
      id: "msg-5-1",
      conversationId: "conv-5",
      senderId: "current-user",
      senderName: "You",
      content: "Jessica, reminder about the youth ministry meeting tomorrow at 6pm.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30),
      isOutgoing: true,
      status: "read",
    },
    {
      id: "msg-5-2",
      conversationId: "conv-5",
      senderId: "contact-5",
      senderName: "Jessica Martinez",
      content: "Can we reschedule?",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      isOutgoing: false,
    },
  ],
};

export const getConversations = (): Conversation[] => {
  return mockConversations;
};

export const getMessages = (conversationId: string): Message[] => {
  return mockMessages[conversationId] || [];
};

export const getConversation = (conversationId: string): Conversation | undefined => {
  return mockConversations.find(c => c.id === conversationId);
};
