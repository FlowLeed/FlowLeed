
import React from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, MessageSquare, Calendar } from "lucide-react";
import { hostTeamPipeline, pastoralCarePipeline } from "@/data/mockData";
import { calculatePipelineContactCount } from "@/lib/utils";

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
  const pipelines = [
    {
      title: "Host Team Launch",
      description: "Track and manage people interested in joining the host team",
      icon: Users,
      contactCount: calculatePipelineContactCount(hostTeamPipeline),
      path: "/pipelines/host-team",
    },
    {
      title: "Pastoral Care",
      description: "Follow-up system for pastoral care and counseling requests",
      icon: MessageSquare,
      contactCount: calculatePipelineContactCount(pastoralCarePipeline),
      path: "/pipelines/pastoral-care",
    },
    {
      title: "Operations",
      description: "Workflow for operational tasks and processes",
      icon: Calendar,
      contactCount: 0, // No data available yet
      path: "/pipelines/operations",
    },
    {
      title: "Giving Hub",
      description: "Manage donation follow-ups and financial communications",
      icon: Users,
      contactCount: 0, // No data available yet
      path: "/pipelines/giving-hub",
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Dashboard" showAddButton={false} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Welcome to Flow</h1>
          <h2 className="text-lg font-medium text-gray-700 mb-4">Your Pipelines</h2>
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
