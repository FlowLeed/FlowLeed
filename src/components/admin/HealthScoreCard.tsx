import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { Activity, Workflow, MessageSquare, Database, Sparkles, TrendingUp, CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface HealthScoreData {
  total_score: number;
  breakdown: {
    user_activity: { score: number; max: number };
    flows_usage: { score: number; max: number };
    followups: { score: number; max: number };
    pco_sync: { score: number; max: number };
    ai_usage: { score: number; max: number };
    engagement_growth: { score: number; max: number };
    setup: { score: number; max: number };
  };
  metrics: {
    avg_logins_per_user_per_week: number;
    people_moved_per_week: number;
    active_flows_count: number;
    completion_rate: number;
    interactions_per_week: number;
    last_pco_sync_days: number;
    ai_uses_30d: number;
    contact_growth_percent: number;
    total_users: number;
    contacts_now: number;
  };
  setup_checklist: {
    profile_completed: boolean;
    team_invited: boolean;
    first_flow_created: boolean;
    pco_connected: boolean;
    first_contact_added: boolean;
  };
}

interface HealthScoreCardProps {
  data: HealthScoreData | null;
  loading?: boolean;
}

export const HealthScoreCard = ({ data, loading }: HealthScoreCardProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Health Score</CardTitle>
          <CardDescription>Loading health metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
                <div className="h-2 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Health Score</CardTitle>
          <CardDescription>No health data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Health score will be calculated based on organization activity.
          </p>
        </CardContent>
      </Card>
    );
  }

  const components = [
    {
      icon: Activity,
      name: "User Activity",
      score: data.breakdown.user_activity.score,
      max: data.breakdown.user_activity.max,
      metric: `${data.metrics.avg_logins_per_user_per_week.toFixed(1)} logins/user/week`,
      description: "Login frequency & engagement"
    },
    {
      icon: Workflow,
      name: "Flows Usage",
      score: data.breakdown.flows_usage.score,
      max: data.breakdown.flows_usage.max,
      metric: `${data.metrics.people_moved_per_week.toFixed(1)} moves/week, ${data.metrics.active_flows_count} flows`,
      description: "Pipeline effectiveness"
    },
    {
      icon: MessageSquare,
      name: "Follow-Ups Done",
      score: data.breakdown.followups.score,
      max: data.breakdown.followups.max,
      metric: `${data.metrics.completion_rate.toFixed(0)}% completion, ${data.metrics.interactions_per_week.toFixed(0)}/week`,
      description: "Pastoral care actions"
    },
    {
      icon: Database,
      name: "PCO Sync Health",
      score: data.breakdown.pco_sync.score,
      max: data.breakdown.pco_sync.max,
      metric: data.metrics.last_pco_sync_days < 999 
        ? `Last sync ${data.metrics.last_pco_sync_days} days ago`
        : "Never synced",
      description: "Integration reliability"
    },
    {
      icon: Sparkles,
      name: "AI Features Used",
      score: data.breakdown.ai_usage.score,
      max: data.breakdown.ai_usage.max,
      metric: `${data.metrics.ai_uses_30d} uses in 30 days`,
      description: "Time-saving automation"
    },
    {
      icon: TrendingUp,
      name: "Engagement Growth",
      score: data.breakdown.engagement_growth.score,
      max: data.breakdown.engagement_growth.max,
      metric: `${data.metrics.contact_growth_percent.toFixed(1)}% growth`,
      description: "Contact base expansion"
    },
    {
      icon: CheckCircle,
      name: "Admin Setup",
      score: data.breakdown.setup.score,
      max: data.breakdown.setup.max,
      metric: `${Object.values(data.setup_checklist).filter(Boolean).length}/5 completed`,
      description: "Onboarding completion"
    }
  ];

  const getRecommendations = (): string[] => {
    const recs: string[] = [];
    
    if (data.breakdown.user_activity.score < 15) {
      recs.push("💡 Low login activity - Encourage team to log in daily");
    }
    if (data.breakdown.flows_usage.score < 10) {
      recs.push("💡 Low flow usage - Review and activate flows to move people through");
    }
    if (data.breakdown.followups.score < 8) {
      recs.push("💡 Low follow-ups - Complete pending interactions to boost score");
    }
    if (data.breakdown.pco_sync.score < 5) {
      recs.push("💡 Stale PCO sync - Reconnect Planning Center for updated contacts");
    }
    if (data.breakdown.ai_usage.score < 5) {
      recs.push("💡 Low AI usage - Try AI suggestions to save time on messaging");
    }
    if (data.breakdown.engagement_growth.score < 5) {
      recs.push("💡 Low growth - Add new contacts to expand reach");
    }
    if (data.breakdown.setup.score < 8) {
      const incomplete = [];
      if (!data.setup_checklist.profile_completed) incomplete.push("profile");
      if (!data.setup_checklist.team_invited) incomplete.push("team members");
      if (!data.setup_checklist.first_flow_created) incomplete.push("first flow");
      if (!data.setup_checklist.pco_connected) incomplete.push("PCO integration");
      if (!data.setup_checklist.first_contact_added) incomplete.push("first contact");
      recs.push(`💡 Incomplete setup - Complete: ${incomplete.join(", ")}`);
    }
    
    return recs;
  };

  const recommendations = getRecommendations();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Health Score</CardTitle>
            <CardDescription>How healthy and active this organization is</CardDescription>
          </div>
          <HealthScoreBadge score={data.total_score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Component Breakdown */}
        <div className="space-y-4">
          {components.map((component) => {
            const Icon = component.icon;
            const percentage = (component.score / component.max) * 100;
            
            return (
              <div key={component.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{component.name}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {component.score.toFixed(1)}/{component.max}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="flex items-start justify-between text-xs text-muted-foreground">
                  <span>{component.description}</span>
                  <span className="text-right">{component.metric}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Recommendations</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Summary Stats */}
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Users</p>
            <p className="text-2xl font-semibold">{data.metrics.total_users}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Contacts</p>
            <p className="text-2xl font-semibold">{data.metrics.contacts_now}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
