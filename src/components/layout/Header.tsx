
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
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  return (
    <div className="flex items-center justify-between h-16 px-6 border-b border-crm-border">
      <div className="text-xl font-semibold">{title}</div>
      <div className="flex items-center gap-4">
        {showAddButton && (
          <Button onClick={onAddClick} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            {addButtonLabel}
          </Button>
        )}
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
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{user?.email}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
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
