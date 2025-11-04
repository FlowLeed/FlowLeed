import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMyFlows } from "@/hooks/useMyFlows";
import { useOrgOwnerOnboarding } from "@/hooks/useOrgOwnerOnboarding";
import { useMemberOnboarding } from "@/hooks/useMemberOnboarding";
import { PersonalMetrics } from "@/components/dashboard/PersonalMetrics";
import { ContactsNeedingAttention } from "@/components/dashboard/ContactsNeedingAttention";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import { TeamActivityFeed } from "@/components/dashboard/TeamActivityFeed";
import { MyFlowsQuickAccess } from "@/components/dashboard/MyFlowsQuickAccess";
import { OnboardingProgressBar } from "@/components/onboarding/OnboardingProgressBar";
import { OnboardingChecklist, ChecklistItem } from "@/components/onboarding/OnboardingChecklist";
import { OnboardingCelebration } from "@/components/onboarding/OnboardingCelebration";
import { OwnerOnboardingWizard } from "@/components/onboarding/OwnerOnboardingWizard";
import { MemberOnboardingWizard } from "@/components/onboarding/MemberOnboardingWizard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, organization } = useProfile();
  
  console.log('[Dashboard] user?.id:', user?.id);
  console.log('[Dashboard] profile:', profile);
  
  // PHASE 2: Consolidated dashboard data hook - fetches all data in parallel
  const { data: dashboardData, isLoading: dashboardLoading, error: metricsError } = useDashboardData(user?.id);
  const { data: myFlows, isLoading: flowsLoading } = useMyFlows(user?.id);
  
  // Extract data from consolidated query
  const metrics = dashboardData?.metrics;
  const contactsNeedingAttention = dashboardData?.contactsNeedingAttention || [];
  const upcomingTasks = dashboardData?.upcomingTasks || [];
  const teamActivity = dashboardData?.activityFeed || [];
  
  console.log('[Dashboard] metrics:', metrics);
  console.log('[Dashboard] dashboardLoading:', dashboardLoading);
  console.log('[Dashboard] metricsError:', metricsError);

  // Onboarding state
  const [isOwner, setIsOwner] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showOwnerWizard, setShowOwnerWizard] = useState(false);
  const [showMemberWizard, setShowMemberWizard] = useState(false);

  const ownerOnboarding = useOrgOwnerOnboarding(organization?.id);
  const memberOnboarding = useMemberOnboarding(user?.id);

  // Check if user is organization owner
  useEffect(() => {
    const checkRole = async () => {
      if (!user?.id || !organization?.id) return;

      const { data } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", organization.id)
        .single();

      const userIsOwner = data?.role === "owner";
      setIsOwner(userIsOwner);

      // Mark initial load as complete
      setIsInitialLoadComplete(true);

      // Show wizard on first visit for incomplete onboarding
      const hasSeenWizard = localStorage.getItem(`wizard-seen-${user.id}`);
      if (!hasSeenWizard) {
        if (userIsOwner && !ownerOnboarding.isCompleted && !ownerOnboarding.isLoading) {
          setShowOwnerWizard(true);
          localStorage.setItem(`wizard-seen-${user.id}`, "true");
        } else if (!userIsOwner && !memberOnboarding.isCompleted && !memberOnboarding.isDismissed && !memberOnboarding.isLoading) {
          setShowMemberWizard(true);
          localStorage.setItem(`wizard-seen-${user.id}`, "true");
        }
      }
    };

    checkRole();
  }, [user?.id, organization?.id, ownerOnboarding.isCompleted, ownerOnboarding.isLoading, memberOnboarding.isCompleted, memberOnboarding.isDismissed, memberOnboarding.isLoading]);

  // Show celebration when onboarding is complete
  useEffect(() => {
    if (isOwner && ownerOnboarding.completedSteps === ownerOnboarding.totalSteps && !ownerOnboarding.isCompleted) {
      setShowCelebration(true);
    } else if (!isOwner && memberOnboarding.completedSteps === memberOnboarding.totalSteps && !memberOnboarding.isCompleted) {
      setShowCelebration(true);
    }
  }, [isOwner, ownerOnboarding.completedSteps, ownerOnboarding.totalSteps, ownerOnboarding.isCompleted, memberOnboarding.completedSteps, memberOnboarding.totalSteps, memberOnboarding.isCompleted]);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Owner checklist items
  const ownerChecklistItems: ChecklistItem[] = [
    {
      id: "first_flow_created",
      title: "Create Your First Flow",
      description: "Set up a flow to track contacts through different stages",
      completed: ownerOnboarding.progress.first_flow_created,
      action: {
        label: "Create Flow",
        onClick: () => navigate("/"),
      },
    },
    {
      id: "pco_connected",
      title: "Connect Planning Center",
      description: "Sync your PCO lists and contacts automatically",
      completed: ownerOnboarding.progress.pco_connected,
      action: {
        label: "Connect",
        onClick: () => navigate("/integrations"),
      },
    },
    {
      id: "pco_lists_mapped",
      title: "Map PCO Lists to Flows",
      description: "Link your lists to the right flows for automatic sync",
      completed: ownerOnboarding.progress.pco_lists_mapped,
      action: {
        label: "Map Lists",
        onClick: () => navigate("/integrations"),
      },
    },
    {
      id: "team_members_invited",
      title: "Invite Team Members",
      description: "Add staff and volunteers to collaborate",
      completed: ownerOnboarding.progress.team_members_invited,
      action: {
        label: "Invite",
        onClick: () => navigate("/team"),
      },
    },
    {
      id: "flow_owners_assigned",
      title: "Assign Flow Owners",
      description: "Designate team members to manage specific flows",
      completed: ownerOnboarding.progress.flow_owners_assigned,
      action: {
        label: "Assign",
        onClick: () => navigate("/"),
      },
    },
  ];

  // Member checklist items
  const memberChecklistItems: ChecklistItem[] = [
    {
      id: "profile_completed",
      title: "Complete Your Profile",
      description: "Add your name and photo so your team recognizes you",
      completed: memberOnboarding.progress.profile_completed,
      action: {
        label: "Update Profile",
        onClick: () => navigate("/profile"),
      },
    },
    {
      id: "flows_reviewed",
      title: "Review Your Flows",
      description: "See which ministry areas you'll help manage",
      completed: memberOnboarding.progress.flows_reviewed,
    },
    {
      id: "first_interaction",
      title: "Explore a People",
      description: "Click a card to view details and next steps for that person.",
      completed: memberOnboarding.progress.first_interaction,
    },
  ];

  const shouldShowOnboarding = isInitialLoadComplete && (isOwner 
    ? !ownerOnboarding.isCompleted && !ownerOnboarding.isLoading
    : !memberOnboarding.isCompleted && !memberOnboarding.isDismissed && !memberOnboarding.isLoading);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={`Welcome back, ${profile?.full_name || "there"}!`} showAddButton={false} showFlowIcon={false} />
      
      {/* Onboarding Progress Bar */}
      {shouldShowOnboarding && (
        <OnboardingProgressBar
          currentStep={isOwner ? ownerOnboarding.currentStep : memberOnboarding.currentStep}
          totalSteps={isOwner ? ownerOnboarding.totalSteps : memberOnboarding.totalSteps}
          completedSteps={isOwner ? ownerOnboarding.completedSteps : memberOnboarding.completedSteps}
          onDismiss={!isOwner ? memberOnboarding.dismissOnboarding : undefined}
        />
      )}

      <div className="flex-1 overflow-auto hide-scrollbar p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Date */}
          <p className="text-sm text-muted-foreground">{currentDate}</p>

          {/* Onboarding Checklist */}
          {shouldShowOnboarding && (
            <OnboardingChecklist
              title={isOwner ? "Get Your Organization Ready" : "Get Started with FlowLeed"}
              description={
                isOwner
                  ? "Complete these steps to set up your organization"
                  : "Complete these steps to start serving your community"
              }
              checklist={isOwner ? ownerChecklistItems : memberChecklistItems}
            />
          )}

          {/* Personal Metrics */}
          <PersonalMetrics
            metrics={metrics || { myContacts: 0, myInteractions: 0, pendingTasks: 0, peopleNeedingAttention: 0 }}
            loading={dashboardLoading}
          />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* People Needing Attention */}
            <ContactsNeedingAttention
              contacts={contactsNeedingAttention || []}
              loading={dashboardLoading}
            />

            {/* Upcoming Tasks */}
            <UpcomingTasks
              tasks={upcomingTasks || []}
              loading={dashboardLoading}
            />
          </div>

          {/* Team Activity Feed */}
          <TeamActivityFeed
            activities={teamActivity || []}
            loading={dashboardLoading}
          />

          {/* My Flows Quick Access */}
          <MyFlowsQuickAccess
            flows={myFlows || []}
            loading={flowsLoading}
          />
        </div>
      </div>

      {/* Onboarding Wizards */}
      <OwnerOnboardingWizard
        open={showOwnerWizard}
        onOpenChange={setShowOwnerWizard}
        progress={ownerOnboarding.progress}
      />
      <MemberOnboardingWizard
        open={showMemberWizard}
        onOpenChange={setShowMemberWizard}
        progress={memberOnboarding.progress}
      />

      {/* Celebration */}
      {showCelebration && (
        <OnboardingCelebration
          message={isOwner ? "You're ready to flow forward! 🌊" : "You're Ready to Serve! 🎉"}
          ctaLabel={isOwner ? "Start Managing Contacts" : "View My Flows"}
          onComplete={() => {
            setShowCelebration(false);
            if (isOwner) {
              ownerOnboarding.completeOnboarding();
            } else {
              memberOnboarding.completeOnboarding();
            }
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
