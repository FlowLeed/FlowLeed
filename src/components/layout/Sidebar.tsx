
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Users, 
  MessageSquare, 
  Check,
  Calendar, 
  Settings 
} from "lucide-react";
import { calculatePipelineContactCount } from "@/lib/utils";
import { usePipelineContext } from "@/contexts/PipelineContext";

interface SidebarItem {
  title: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
}

interface SidebarSectionProps {
  title: string;
  items: SidebarItem[];
}

const NavItem = ({ item, isActive }: { item: SidebarItem; isActive: boolean }) => {
  return (
    <Link
      to={item.path}
      className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      }`}
    >
      <item.icon className="mr-3 h-5 w-5" />
      <span>{item.title}</span>
      {item.badge && (
        <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
          {item.badge}
        </span>
      )}
    </Link>
  );
};

const SidebarSection: React.FC<SidebarSectionProps> = ({ title, items }) => {
  const location = useLocation();
  
  return (
    <div className="space-y-1">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <NavItem
            key={item.title}
            item={item}
            isActive={location.pathname === item.path}
          />
        ))}
      </div>
    </div>
  );
};

const Logo = () => (
  <div className="px-4 py-6 flex items-center">
    <span className="text-2xl font-bold text-sidebar-primary">Flow</span>
  </div>
);

export const Sidebar = () => {
  const { pipelines } = usePipelineContext();
  
  const pageItems: SidebarItem[] = [
    {
      title: "Dashboard",
      icon: Users,
      path: "/",
    },
    {
      title: "Analytics",
      icon: MessageSquare,
      path: "/analytics",
    },
  ];

  const flowItems: SidebarItem[] = [
    {
      title: "Host Team Launch",
      icon: Users,
      path: "/pipelines/host-team",
      badge: calculatePipelineContactCount(pipelines["host-team"]),
    },
    {
      title: "Pastoral Care",
      icon: MessageSquare,
      path: "/pipelines/pastoral-care",
      badge: calculatePipelineContactCount(pipelines["pastoral-care"]),
    },
    {
      title: "Operations",
      icon: Calendar,
      path: "/pipelines/operations",
      badge: 0, // No data available yet
    },
    {
      title: "Giving Hub",
      icon: Users,
      path: "/pipelines/giving-hub",
      badge: 0, // No data available yet
    },
  ];

  const settingsItems: SidebarItem[] = [
    {
      title: "My Profile",
      icon: Settings,
      path: "/profile",
    },
  ];

  return (
    <div className="h-screen w-64 border-r border-sidebar-border bg-sidebar-background flex flex-col">
      <Logo />
      <div className="flex-1 overflow-auto py-2 space-y-6">
        <SidebarSection title="Pages" items={pageItems} />
        <SidebarSection title="Flows" items={flowItems} />
        <SidebarSection title="Settings" items={settingsItems} />
      </div>
    </div>
  );
};
