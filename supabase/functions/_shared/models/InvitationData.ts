export interface InvitationData {
    id: string;
    organization_id: string;
    email: string;
    role: string;
    organization_name: string;
    inviter_name: string;
    expires_at: string;
    accepted_at: string | null;
    user_exists: boolean;
  }