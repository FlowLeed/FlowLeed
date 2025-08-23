
import React from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Bell, Search, LogOut, User, Settings, Workflow, Settings2, Users, MessageSquare, Calendar, Heart, Star, Target, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Puzzle, LayoutDashboard, BarChart3 } from "lucide-react";
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
import { usePipelineContext } from "@/contexts/PipelineContext";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

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
  const { pipelines } = usePipelineContext();
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();

  // Icon mapping object
  const iconMap: { [key: string]: LucideIcon } = {
    'Users': Users,
    'MessageSquare': MessageSquare,
    'Calendar': Calendar,
    'Settings': Settings,
    'Heart': Heart,
    'Star': Star,
    'Target': Target,
    'Zap': Zap,
    'Shield': Shield,
    'Globe': Globe,
    'Briefcase': Briefcase,
    'BookOpen': BookOpen,
    'Music': Music,
    'Coffee': Coffee,
    'Camera': Camera,
    'Gift': Gift,
    'Flame': Flame,
    'Sparkles': Sparkles,
    'Check': Check,
    'Plus': Plus,
    'Puzzle': Puzzle,
    'LayoutDashboard': LayoutDashboard,
    'BarChart3': BarChart3
  };

  // Get the current pipeline and its icon
  const currentPipeline = pipelineId ? Object.values(pipelines).find(p => p.id === pipelineId) : null;
  let FlowIcon = Workflow; // Default fallback

  if (currentPipeline?.icon && iconMap[currentPipeline.icon]) {
    FlowIcon = iconMap[currentPipeline.icon];
  } else if (currentPipeline) {
    // Fallback to name-based icon selection
    const name = currentPipeline.name.toLowerCase();
    if (name.includes('pastoral') || name.includes('care')) {
      FlowIcon = MessageSquare;
    } else if (name.includes('operation') || name.includes('ops')) {
      FlowIcon = Calendar;
    } else if (name.includes('host') || name.includes('team')) {
      FlowIcon = Users;
    } else if (name.includes('giving') || name.includes('hub')) {
      FlowIcon = Heart;
    }
  }

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
      <div className="flex items-center gap-3">
        <FlowIcon className="h-6 w-6 text-primary" />
        <div className="text-xl font-semibold">{title}</div>
        <Button variant="ghost" size="sm" className="ml-2">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
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
