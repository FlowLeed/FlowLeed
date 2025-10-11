import React from "react";
import { 
  Users, MessageSquare, Calendar, Settings, Heart, Star, Target, Zap,
  Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift,
  Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3, Workflow,
  Church, Cross, Book, Handshake, HeartHandshake, Podcast, Video,
  UserCheck, Users2, GraduationCap, Baby, TrendingUp, Waves, Fish,
  Sun, Moon, Navigation, MapPin, Home, Smile, Footprints
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FlowIconBadgeProps {
  flow: {
    name: string;
    icon: string;
  };
  size?: "sm" | "md";
  showTooltip?: boolean;
}

const iconMap: { [key: string]: React.ComponentType<any> } = {
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
  'BarChart3': BarChart3,
  'Workflow': Workflow,
  'Church': Church,
  'Cross': Cross,
  'Book': Book,
  'Footprints': Footprints,
  'Handshake': Handshake,
  'HeartHandshake': HeartHandshake,
  'Fish': Fish,
  'Waves': Waves,
  'Sun': Sun,
  'Moon': Moon,
  'Podcast': Podcast,
  'Video': Video,
  'UserCheck': UserCheck,
  'Users2': Users2,
  'GraduationCap': GraduationCap,
  'Baby': Baby,
  'TrendingUp': TrendingUp,
  'Navigation': Navigation,
  'MapPin': MapPin,
  'Home': Home,
  'Smile': Smile
};

export const FlowIconBadge: React.FC<FlowIconBadgeProps> = ({ 
  flow, 
  size = "md", 
  showTooltip = true 
}) => {
  const IconComponent = iconMap[flow.icon] || Users;
  
  const sizeClasses = {
    sm: "h-5 w-5 p-1",
    md: "h-6 w-6 p-1.5"
  };
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3 w-3"
  };

  return (
    <div className="relative group">
      <Badge 
        variant="outline" 
        className={cn(
          "rounded-full border-muted-foreground/20 bg-background hover:bg-muted/50 transition-colors",
          sizeClasses[size]
        )}
        title={showTooltip ? flow.name : undefined}
      >
        <IconComponent className={iconSizes[size]} />
      </Badge>
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md border shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
          {flow.name}
        </div>
      )}
    </div>
  );
};