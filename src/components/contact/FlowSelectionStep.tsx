import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Workflow, Users, MessageSquare, Calendar, Settings, Heart, Star, Target, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3, Church, Cross, Book, Handshake, HeartHandshake, Podcast, Video, UserCheck, Users2, GraduationCap, Baby, TrendingUp, Waves, Fish, Sun, Moon, Navigation, MapPin, Home, Smile, Footprints } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface FlowSelectionStepProps {
  pipelines: Pipeline[];
  loading: boolean;
  onSelect: (pipeline: Pipeline) => void;
}

export const FlowSelectionStep: React.FC<FlowSelectionStepProps> = ({
  pipelines,
  loading,
  onSelect
}) => {
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
    'BarChart3': BarChart3,
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
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No available flows to add this contact to.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {pipelines.map((pipeline) => (
        <Card
          key={pipeline.id}
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => onSelect(pipeline)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {(() => {
                if (pipeline.icon && iconMap[pipeline.icon]) {
                  const IconComponent = iconMap[pipeline.icon];
                  return <IconComponent className="h-5 w-5 text-muted-foreground" />;
                }
                return <Workflow className="h-5 w-5 text-muted-foreground" />;
              })()}
              <div className="flex-1">
                <h3 className="font-medium">{pipeline.name}</h3>
                {pipeline.description && (
                  <p className="text-sm text-muted-foreground truncate">{pipeline.description}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};