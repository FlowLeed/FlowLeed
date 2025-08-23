
import React from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, MessageSquare, Calendar, Heart, Star, Target, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3, Settings } from "lucide-react";
import { calculatePipelineContactCount } from "@/lib/utils";
import { usePipelineContext } from "@/contexts/PipelineContext";
import type { LucideIcon } from "lucide-react";

const PipelineCard = ({ 
  title, 
  description, 
  icon: Icon, 
  contactCount,
  path 
}: { 
  title: string; 
  description: string; 
  icon: React.ElementType; 
  contactCount: number;
  path: string;
}) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="p-2 bg-crm-muted rounded-md">
            <Icon className="h-5 w-5 text-crm-primary" />
          </div>
          <span className="text-sm font-medium text-gray-500">{contactCount} contacts</span>
        </div>
        <CardTitle className="mt-4 text-xl">{title}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link to={path}>
          <Button variant="outline" className="w-full justify-between">
            View Pipeline
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { pipelines: pipelineData, loading, error } = usePipelineContext();
  
  // Create pipeline cards from actual database data
  const pipelines = Object.entries(pipelineData).map(([key, pipeline]) => {
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

    // Use the stored icon if available, otherwise determine icon based on pipeline name  
    let icon = Users; // Default fallback
    
    if (pipeline.icon && iconMap[pipeline.icon]) {
      icon = iconMap[pipeline.icon];
    } else {
      // Fallback to name-based icon selection for existing pipelines without stored icons
      const name = pipeline.name.toLowerCase();
      if (name.includes('pastoral') || name.includes('care')) {
        icon = MessageSquare;
      } else if (name.includes('operation') || name.includes('ops')) {
        icon = Calendar;
      } else if (name.includes('host') || name.includes('team')) {
        icon = Users;
      } else if (name.includes('giving') || name.includes('hub')) {
        icon = Heart;
      }
    }

    return {
      title: pipeline.name,
      description: pipeline.description || `Manage and track contacts through the ${pipeline.name} process`,
      icon,
      contactCount: calculatePipelineContactCount(pipeline),
      path: `/pipelines/${pipeline.id}`,
    };
  });

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title="Dashboard" showAddButton={false} />
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Welcome to Flow</h1>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary mx-auto mb-4"></div>
                <p className="text-gray-500">Loading pipelines...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title="Dashboard" showAddButton={false} />
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Welcome to Flow</h1>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-500 mb-4">Error loading pipelines: {error}</p>
                <Button onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Dashboard" showAddButton={false} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Welcome to Flow</h1>
          <h2 className="text-lg font-medium text-gray-700 mb-4">Your Flows</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pipelines.map((pipeline) => (
              <PipelineCard
                key={pipeline.title}
                title={pipeline.title}
                description={pipeline.description}
                icon={pipeline.icon}
                contactCount={pipeline.contactCount}
                path={pipeline.path}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
