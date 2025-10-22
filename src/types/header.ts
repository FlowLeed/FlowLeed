import { LucideIcon } from "lucide-react";

export interface BaseHeaderProps {
  // Left section
  title: string;
  description?: string;
  icon?: LucideIcon;
  
  // Always show back button
  onBackClick?: () => void; // If not provided, defaults to navigate(-1)
  
  // Center section (optional - for filters, view modes)
  centerContent?: React.ReactNode;
  
  // Right section - always visible, but customizable
  rightContent?: React.ReactNode; // Replaces default actions
  customActions?: React.ReactNode; // Adds to default actions
  
  // Positioning behavior
  position?: 'sticky' | 'fixed';
  
  // Always show these (default: true)
  showNotifications?: boolean;
  showSearch?: boolean;
  showUserMenu?: boolean;
}

export interface HeaderLeftProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  onBackClick?: () => void;
}

export interface HeaderRightProps {
  showNotifications?: boolean;
  showSearch?: boolean;
  showUserMenu?: boolean;
  customActions?: React.ReactNode;
}
