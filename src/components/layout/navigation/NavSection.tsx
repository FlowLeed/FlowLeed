import React from "react";
import { NavItem } from "./NavItem";
import type { NavSectionConfig } from "@/types/navigation";

interface NavSectionProps extends NavSectionConfig {}

export const NavSection: React.FC<NavSectionProps> = ({
  title,
  items,
  actions,
}) => {
  return (
    <div className="space-y-1">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {title}
        </div>
        {actions}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <NavItem key={item.title} item={item} />
        ))}
      </div>
    </div>
  );
};
