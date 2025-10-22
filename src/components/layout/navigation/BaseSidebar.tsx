import React from "react";
import { NavSection } from "./NavSection";
import type { NavSectionConfig } from "@/types/navigation";

interface BaseSidebarProps {
  logo: React.ReactNode;
  sections: NavSectionConfig[];
  width?: string;
  children?: React.ReactNode;
}

export const BaseSidebar: React.FC<BaseSidebarProps> = ({
  logo,
  sections,
  width = "w-64",
  children,
}) => {
  return (
    <div className={`${width} bg-sidebar border-r border-border flex flex-col h-screen sticky top-0 flex-shrink-0`}>
      {/* Logo Section */}
      <div className="flex-shrink-0">
        {logo}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 px-4 space-y-6 overflow-y-auto">
        {sections.map((section) => (
          <NavSection key={section.title} {...section} />
        ))}
      </div>

      {/* Additional Content (dialogs, etc) */}
      {children}
    </div>
  );
};
