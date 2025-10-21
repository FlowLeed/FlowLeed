import { CallRecord } from "@/types/calls";

const mockCalls: CallRecord[] = [
  {
    id: "call-1",
    contactId: "1",
    contactName: "Sarah Johnson",
    contactRole: "New Visitor",
    callType: "inbound",
    status: "answered",
    duration: 245, // 4 minutes 5 seconds
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    phoneNumber: "+1 (555) 123-4567",
  },
  {
    id: "call-2",
    contactId: "2",
    contactName: "Michael Chen",
    contactRole: "Regular Attendee",
    callType: "outbound",
    status: "answered",
    duration: 180, // 3 minutes
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    phoneNumber: "+1 (555) 234-5678",
  },
  {
    id: "call-3",
    contactId: "3",
    contactName: "Emily Rodriguez",
    contactRole: "Volunteer",
    callType: "missed",
    status: "missed",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    phoneNumber: "+1 (555) 345-6789",
  },
  {
    id: "call-4",
    contactId: "4",
    contactName: "James Wilson",
    callType: "outbound",
    status: "answered",
    duration: 420, // 7 minutes
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
    phoneNumber: "+1 (555) 456-7890",
  },
  {
    id: "call-5",
    contactId: "5",
    contactName: "Lisa Thompson",
    contactRole: "Small Group Leader",
    callType: "inbound",
    status: "voicemail",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    phoneNumber: "+1 (555) 567-8901",
  },
  {
    id: "call-6",
    contactId: "6",
    contactName: "David Martinez",
    callType: "inbound",
    status: "answered",
    duration: 125, // 2 minutes 5 seconds
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    phoneNumber: "+1 (555) 678-9012",
  },
  {
    id: "call-7",
    contactId: "7",
    contactName: "Amanda Foster",
    contactRole: "New Member",
    callType: "outbound",
    status: "missed",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    phoneNumber: "+1 (555) 789-0123",
  },
  {
    id: "call-8",
    contactId: "8",
    contactName: "Robert Kim",
    callType: "inbound",
    status: "answered",
    duration: 310, // 5 minutes 10 seconds
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4), // 4 days ago
    phoneNumber: "+1 (555) 890-1234",
  },
  {
    id: "call-9",
    contactId: "9",
    contactName: "Jennifer Lee",
    contactRole: "Youth Leader",
    callType: "outbound",
    status: "answered",
    duration: 540, // 9 minutes
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
    phoneNumber: "+1 (555) 901-2345",
  },
  {
    id: "call-10",
    contactId: "10",
    contactName: "Christopher Brown",
    callType: "missed",
    status: "missed",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6), // 6 days ago
    phoneNumber: "+1 (555) 012-3456",
  },
];

export const getCalls = (): CallRecord[] => {
  return mockCalls.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const getCallById = (id: string): CallRecord | undefined => {
  return mockCalls.find((call) => call.id === id);
};

export const getCallsByContact = (contactId: string): CallRecord[] => {
  return mockCalls
    .filter((call) => call.contactId === contactId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};
