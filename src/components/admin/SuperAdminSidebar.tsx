import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, Users, DollarSign, Settings } from "lucide-react";
import flowleedLogo from "@/assets/flowleed_logo.png";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  title: string;
  icon: LucideIcon;
  path: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  {
    title: "Organizations",
    icon: Building2,
    path: "/fl-admin",
  },
  {
    title: "Users",
    icon: Users,
    path: "/fl-admin/users",
    disabled: true,
  },
  {
    title: "Billing",
    icon: DollarSign,
    path: "/fl-admin/billing",
    disabled: true,
  },
  {
    title: "Settings",
    icon: Settings,
    path: "/fl-admin/settings",
    disabled: true,
  },
];

const NavLink = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
  const content = (
    <div
      className={`flex items-center px-8 py-2.5 rounded-full text-sm font-medium transition-colors ${
        item.disabled
          ? "text-sidebar-foreground/30 cursor-not-allowed"
          : isActive
          ? "bg-purple-500 text-white"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 cursor-pointer"
      }`}
    >
      <item.icon className={`mr-3 h-5 w-5 ${item.disabled ? "text-sidebar-foreground/30" : isActive ? "text-white" : "text-purple-500"}`} />
      <span className="font-extralight">{item.title}</span>
      {item.disabled && (
        <span className="ml-auto text-xs text-sidebar-foreground/30">Soon</span>
      )}
    </div>
  );

  if (item.disabled) {
    return <div className="cursor-not-allowed">{content}</div>;
  }

  return <Link to={item.path}>{content}</Link>;
};

export const SuperAdminSidebar = () => {
  const location = useLocation();

  return (
    <div className="w-60 bg-sidebar border-r border-border flex flex-col">
      {/* Logo Section */}
      <div className="px-8 py-6 flex flex-col">
        <img src={flowleedLogo} alt="Flowleed" className="h-5 w-auto mb-1" />
        <span className="text-xs text-sidebar-foreground/50 font-medium">FL-Admin</span>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-4">
        <div className="space-y-1">
          <div className="px-4 py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Pages
            </div>
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.title}
              item={item}
              isActive={location.pathname === item.path}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
