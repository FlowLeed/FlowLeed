export type CallType = 'inbound' | 'outbound' | 'missed';
export type CallStatus = 'answered' | 'missed' | 'voicemail';

export interface CallRecord {
  id: string;
  contactId: string;
  contactName: string;
  contactAvatar?: string;
  contactRole?: string;
  callType: CallType;
  status: CallStatus;
  duration?: number; // in seconds, undefined if not answered
  timestamp: Date;
  phoneNumber?: string;
}
