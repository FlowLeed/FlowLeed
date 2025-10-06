export type ContactStatus = 'active' | 'inactive' | 'pending';
export type Tag = 'active' | 'partner' | 'location' | 'florida';
export type FlowRole = 'lead' | 'manager' | 'contributor';

export interface Contact {
  id: string;
  name: string;
  avatar?: string;
  date: string;
  tags: Tag[];
  assignedTo?: {
    name: string;
    avatar?: string;
  };
  status: ContactStatus;
  notes?: string;
  email?: string;
  phone?: string;
  stageEnteredAt?: string;
}

export interface FlowStage {
  id: string;
  name: string;
  contacts: Contact[];
  color?: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  stages: FlowStage[];
  icon?: string;
}
