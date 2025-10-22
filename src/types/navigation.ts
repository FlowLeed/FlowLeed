import type { LucideIcon } from "lucide-react";

export interface NavItemConfig {
  title: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
  disabled?: boolean;
}

export interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
  actions?: React.ReactNode;
}
