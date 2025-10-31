export type BlockType = 
  | 'heading' 
  | 'paragraph' 
  | 'divider' 
  | 'checklist' 
  | 'toggle'
  | 'bulletList'
  | 'numberedList'
  | 'image'
  | 'video'
  | 'link';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  level?: number; // for headings (1-3)
  checked?: boolean; // for checklist items
  collapsed?: boolean; // for toggle blocks
  children?: Block[]; // nested blocks (for toggles)
  metadata?: {
    url?: string;
    title?: string;
    thumbnail?: string;
  };
}

export interface FlowResource {
  id: string;
  pipeline_id: string;
  organization_id: string;
  content: Block[];
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
  last_edited_by_user_id: string | null;
}
