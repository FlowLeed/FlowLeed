import React, { useState } from "react";
import { LayoutDashboard, BarChart3, MessageSquare, Phone, Users, Puzzle, Settings, Settings2, Heart, CheckSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iconMap } from "@/lib/flowIcons";
import { calculateFlowContactCount } from "@/lib/utils";
import { useFlowContext } from "@/contexts/FlowContext";
import { FlowsManagementDialog } from "@/components/flows/FlowsManagementDialog";
import { mockConversations } from "@/data/mockMessages";
import flowleedLogo from "@/assets/flowleed_logo.png";
import { BaseSidebar } from "@/components/layout/navigation";
import type { NavItemConfig, NavSectionConfig } from "@/types/navigation";

export const Sidebar = () => {
  const { flows } = useFlowContext();
  const [showFlowsManagement, setShowFlowsManagement] = useState(false);

  // HUB section items
  const pageItems: NavItemConfig[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
    },
    {
      title: "People",
      icon: Users,
      path: "/contacts",
    },
    {
      title: "Analytics",
      icon: BarChart3,
      path: "/analytics",
    },
    {
      title: "Tasks",
      icon: CheckSquare,
      path: "/tasks",
    },
  ];

  // Create flow items dynamically from all flows (database data), sorted by flow_order
  const flowItems: NavItemConfig[] = Object.entries(flows)
    .map(([key, flow]) => ({ flow, key }))
    .sort((a, b) => (a.flow.flow_order || 0) - (b.flow.flow_order || 0))
    .map(({ flow }) => {
      // Use stored icon if available, otherwise determine icon based on flow name
      let icon = Users;

      if (flow.icon && iconMap[flow.icon]) {
        icon = iconMap[flow.icon];
      } else {
        // Fallback to name-based icon selection for existing flows
        const name = flow.name.toLowerCase();
        if (name.includes("pastoral") || name.includes("care")) {
          icon = MessageSquare;
        } else if (name.includes("operation") || name.includes("ops")) {
          icon = Calendar;
        } else if (name.includes("host") || name.includes("team")) {
          icon = Users;
        } else if (name.includes("giving") || name.includes("hub")) {
          icon = Heart;
        }
      }

      return {
        title: flow.name,
        icon,
        path: `/flows/${flow.id}`,
        badge: calculateFlowContactCount(flow),
      };
    });

  // Calculate total unread messages
  const totalUnreadMessages = mockConversations.reduce(
    (sum, conv) => sum + conv.unreadCount,
    0
  );

  // Connect section items
  const connectItems: NavItemConfig[] = [
    {
      title: "Messages",
      icon: MessageSquare,
      path: "/messages",
      badge: totalUnreadMessages,
    },
    {
      title: "Calls",
      icon: Phone,
      path: "/calls",
    },
    {
      title: "Calendar",
      icon: Calendar,
      path: "/calendar",
    },
  ];

  // Settings section items
  const settingsItems: NavItemConfig[] = [
    {
      title: "My Profile",
      icon: Settings,
      path: "/profile",
    },
    {
      title: "My Organization",
      icon: Users,
      path: "/team",
    },
    {
      title: "Integrations",
      icon: Puzzle,
      path: "/integrations",
    },
  ];

  const logo = (
    <div className="px-8 py-6 flex items-center">
      <img src={flowleedLogo} alt="Flowleed" className="h-5 w-auto" />
    </div>
  );

  const sections: NavSectionConfig[] = [
    {
      title: "HUB",
      items: pageItems,
    },
    {
      title: "Flows",
      items: flowItems,
      actions: (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-sidebar-accent"
          onClick={() => setShowFlowsManagement(true)}
        >
          <Settings2 className="h-3 w-3" />
        </Button>
      ),
    },
    {
      title: "Connect",
      items: connectItems,
    },
    {
      title: "Settings",
      items: settingsItems,
    },
  ];

  return (
    <>
      <BaseSidebar logo={logo} sections={sections} width="w-64" />
      <FlowsManagementDialog
        open={showFlowsManagement}
        onOpenChange={setShowFlowsManagement}
      />
    </>
  );
};