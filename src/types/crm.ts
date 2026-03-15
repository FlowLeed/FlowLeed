export type ContactStatus = 'active' | 'inactive' | 'pending';
export type Tag = string; // Changed from enum to string for flexible tags
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
  completedEndAt?: string;
  campusId?: string;
  campusName?: string;
}

export interface FlowStage {
  id: string;
  name: string;
  contacts: Contact[];
  color?: string;
  is_start_step?: boolean;
  is_end_step?: boolean;
  default_assignee_user_id?: string;
  defaultAssignee?: {
    name: string;
    avatar?: string;
  };
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  stages: FlowStage[];
  icon?: string;
  flow_order?: number;
  flow_type?: 'linear' | 'recurring';
  cycle_days?: number;
}
