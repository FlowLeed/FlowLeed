
import React from "react";
import { Link } from "react-router-dom";
import { Plus, Bell, Search, LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  title: string;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showAddButton = true,
  onAddClick,
  addButtonLabel = "New Person"
}) => {
  const { user, signOut } = useAuth();
  const { profile, organization } = useProfile();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = profile?.full_name 
    ? profile.full_name.split(' ').map(name => name.charAt(0)).join('').toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';
  return (
    <div className="flex items-center justify-between h-16 px-6 border-b border-crm-border">
      <div className="text-xl font-semibold">{title}</div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-slate-100">
            <Bell className="h-5 w-5 text-slate-500" />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100">
            <Search className="h-5 w-5 text-slate-500" />
          </button>
          <div className="border-l border-gray-200 h-6 mx-2" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">{displayName}</span>
                  {organization && (
                    <span className="text-xs text-muted-foreground">{organization.name}</span>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div>
                  <div className="font-medium">{displayName}</div>
                  <div className="text-sm font-normal text-muted-foreground">{user?.email}</div>
                  {organization && (
                    <div className="text-xs font-normal text-muted-foreground">{organization.name}</div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
