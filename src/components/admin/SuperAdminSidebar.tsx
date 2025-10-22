import React from "react";
import { Building2, Users, DollarSign, Settings, GitBranch, MessageCircle } from "lucide-react";
import flowleedLogo from "@/assets/flowleed_logo.png";
import { BaseSidebar } from "@/components/layout/navigation";
import type { NavItemConfig, NavSectionConfig } from "@/types/navigation";

const pagesItems: NavItemConfig[] = [
  {
    title: "Organizations",
    icon: Building2,
    path: "/fl-admin",
  },
];

const flowsItems: NavItemConfig[] = [
  {
    title: "Onboarding",
    icon: GitBranch,
    path: "/fl-admin/flows/onboarding",
  },
  {
    title: "Care Flow",
    icon: MessageCircle,
    path: "/fl-admin/flows/ongoing-support",
  },
];

const systemItems: NavItemConfig[] = [
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

export const SuperAdminSidebar = () => {
  const logo = (
    <div className="px-8 py-6 flex flex-col">
      <img src={flowleedLogo} alt="Flowleed" className="h-5 w-auto mb-1" />
      <span className="text-xs text-sidebar-foreground/50 font-medium">FL-Admin</span>
    </div>
  );

  const sections: NavSectionConfig[] = [
    {
      title: "Pages",
      items: pagesItems,
    },
    {
      title: "Flows",
      items: flowsItems,
    },
    {
      title: "System",
      items: systemItems,
    },
  ];

  return <BaseSidebar logo={logo} sections={sections} width="w-64" />;
};
