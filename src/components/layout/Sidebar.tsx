
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  BarChart3, 
  Check,
  Calendar, 
  Settings,
  MessageSquare,
  Users,
  Puzzle,
  Plus,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
      {item.badge && item.badge > 0 && (
        <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
          {item.badge}
        </span>
      )}
    </Link>
  );
};

const SidebarSection: React.FC<SidebarSectionProps> = ({ title, items }) => {
  const location = useLocation();
  const { toast } = useToast();
  const [isConnectedToPC, setIsConnectedToPC] = useState(false); // Simulate Planning Center connection
  
  // Mock Planning Center lists - in real app, this would come from the API
  const planningCenterLists = [
    { id: '1', name: 'New Members', count: 24 },
    { id: '2', name: 'Volunteers', count: 156 },
    { id: '3', name: 'Small Group Leaders', count: 45 },
    { id: '4', name: 'Youth Ministry', count: 78 },
    { id: '5', name: 'Worship Team', count: 32 }
  ];

  const handleCreateFlow = (listName: string) => {
    toast({
      title: "Flow Created",
      description: `New flow created from "${listName}" list`,
    });
  };
  
  return (
    <div className="space-y-1">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {title}
        </div>
        {title === "Flows" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-sidebar-accent">
                <Settings2 className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Create New Flow</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {isConnectedToPC ? (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Planning Center Lists
                  </DropdownMenuLabel>
                  {planningCenterLists.map((list) => (
                    <DropdownMenuItem 
                      key={list.id}
                      onClick={() => handleCreateFlow(list.name)}
                      className="flex items-center justify-between"
                    >
                      <span>{list.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {list.count}
                        </Badge>
                        <Plus className="h-3 w-3" />
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsConnectedToPC(false)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Connection
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    No Planning Center connection
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsConnectedToPC(true)}>
                    <Puzzle className="h-4 w-4 mr-2" />
                    Connect Planning Center
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
    <img src="/lovable-uploads/55fbe855-f2cf-4756-8840-95900f9d4fbf.png" alt="Flowleed" className="h-8 w-auto" />
  </div>
);

export const Sidebar = () => {
  const { pipelines } = usePipelineContext();
  
  const pageItems: SidebarItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
    },
    {
      title: "Analytics",
      icon: BarChart3,
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
      badge: calculatePipelineContactCount(pipelines["operations"]),
    },
    {
      title: "Giving Hub",
      icon: Users,
      path: "/pipelines/giving-hub",
      badge: calculatePipelineContactCount(pipelines["giving-hub"]),
    },
  ];

  const settingsItems: SidebarItem[] = [
    {
      title: "My Profile",
      icon: Settings,
      path: "/profile",
    },
    {
      title: "Integrations",
      icon: Puzzle,
      path: "/integrations",
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
