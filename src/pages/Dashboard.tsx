import React from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, MessageSquare, Calendar, Heart, Star, Target, Zap, Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift, Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3, Settings } from "lucide-react";
import { calculateFlowContactCount } from "@/lib/utils";
import { useFlowContext } from "@/contexts/FlowContext";
import type { LucideIcon } from "lucide-react";
const FlowCard = ({
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
  return <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="p-2 bg-crm-muted rounded-md">
            <Icon className="h-5 w-5 text-crm-primary" />
          </div>
          <span className="text-sm font-medium text-gray-500">{contactCount} contacts</span>
        </div>
        <CardTitle className="mt-4 text-xl font-light">{title}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link to={path}>
          <Button variant="outline" className="w-full justify-between">
            View Flow
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>;
};
const Dashboard = () => {
  const {
    flows: flowData,
    loading,
    error
  } = useFlowContext();

  // Create flow cards from actual database data
  const flows = Object.entries(flowData).map(([key, flow]) => {
    // Icon mapping object
    const iconMap: {
      [key: string]: LucideIcon;
    } = {
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

    // Use the stored icon if available, otherwise determine icon based on flow name  
    let icon = Users; // Default fallback

    if (flow.icon && iconMap[flow.icon]) {
      icon = iconMap[flow.icon];
    } else {
      // Fallback to name-based icon selection for existing flows without stored icons
      const name = flow.name.toLowerCase();
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
      title: flow.name,
      description: flow.description || `Manage and track contacts through the ${flow.name} process`,
      icon,
      contactCount: calculateFlowContactCount(flow),
      path: `/flows/${flow.id}`
    };
  });
  if (loading) {
    return <div className="flex flex-col h-full overflow-hidden">
        <Header title="Dashboard" showAddButton={false} />
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Welcome to Flow</h1>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary mx-auto mb-4"></div>
                <p className="text-gray-500">Loading flows...</p>
              </div>
            </div>
          </div>
        </div>
      </div>;
  }
  if (error) {
    // If it's an organization error, show a different message and stay on dashboard
    if (error.includes("Organization not found")) {
      return <div className="flex flex-col h-full overflow-hidden">
          <Header title="Dashboard" showAddButton={false} />
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-2xl font-bold mb-6">Welcome to Flow</h1>
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <p className="text-gray-600 mb-4">No flows available yet. Create your first flow to get started!</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => window.location.reload()}>
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>;
    }
    return <div className="flex flex-col h-full overflow-hidden">
        <Header title="Dashboard" showAddButton={false} />
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Welcome to Flow</h1>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-500 mb-4">Error loading flows: {error}</p>
                <Button onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>;
  }
  return <div className="flex flex-col h-full overflow-hidden">
      <Header title="Dashboard" showAddButton={false} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl mb-6 font-light">Welcome to Flow</h1>
          <h2 className="text-lg text-gray-700 mb-4 font-normal">Your Flows</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {flows.map(flow => <FlowCard key={flow.title} title={flow.title} description={flow.description} icon={flow.icon} contactCount={flow.contactCount} path={flow.path} />)}
          </div>
        </div>
      </div>
    </div>;
};
export default Dashboard;