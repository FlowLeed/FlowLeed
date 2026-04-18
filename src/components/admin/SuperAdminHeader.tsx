import React from "react";
import { Bell, Search, LogOut, User, Settings, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMobileSidebar } from "@/contexts/MobileSidebarContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

interface SuperAdminHeaderProps {
  title: string;
  icon?: LucideIcon;
}

export const SuperAdminHeader: React.FC<SuperAdminHeaderProps> = ({ title, icon: Icon }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();

  const handleSignOut = async () => {
    await signOut();
    navigate('/fl-admin/login');
  };

  const displayName = user?.email?.split('@')[0] || 'Admin';
  const initials = user?.email?.charAt(0).toUpperCase() || 'A';

  return (
    <div className="sticky top-0 z-50 border-b" style={{ backgroundColor: '#FAFAFA' }}>
      <div className="flex items-center justify-between h-14 px-3 md:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileSidebar}
            className="h-8 w-8 md:hidden flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {Icon && <Icon className="h-5 w-5 text-sidebar-foreground" />}
          <div className="text-lg font-extralight truncate">{title}</div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-full hover:bg-slate-100">
            <Bell className="h-5 w-5 text-slate-500" />
          </button>
          <button className="p-1.5 rounded-full hover:bg-slate-100">
            <Search className="h-5 w-5 text-slate-500" />
          </button>
          <div className="border-l border-gray-200 h-6 mx-2" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-1.5">
                <Avatar className="h-7 w-7">
                  <AvatarImage 
                    src="" 
                    alt={displayName} 
                  />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div>
                  <div className="font-medium">{displayName}</div>
                  <div className="text-sm font-normal text-muted-foreground">{user?.email}</div>
                  <div className="text-xs font-normal text-muted-foreground">Super Admin</div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/fl-admin/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
