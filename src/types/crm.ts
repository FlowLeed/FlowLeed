
export type ContactStatus = 'active' | 'inactive' | 'pending';
export type Tag = 'active' | 'partner' | 'location' | 'florida';

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
}

export interface PipelineStage {
  id: string;
  name: string;
  contacts: Contact[];
  color?: string;
  is_start_step?: boolean;
  is_end_step?: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  icon?: string;
}
