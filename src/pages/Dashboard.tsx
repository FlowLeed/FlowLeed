import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AIChatInput } from "@/components/dashboard/AIChatInput";
import { CategoryChips, type Category } from "@/components/dashboard/CategoryChips";
import { SuggestedPrompts } from "@/components/dashboard/SuggestedPrompts";
import { ChatThread } from "@/components/dashboard/ChatThread";
import { useDashboardChat } from "@/hooks/useDashboardChat";
import { useChatHistory } from "@/hooks/useChatHistory";
import { ChatHistoryDrawer } from "@/components/dashboard/ChatHistoryDrawer";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PcoPersonalConnectPrompt } from "@/components/dashboard/PcoPersonalConnectPrompt";


const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, organization } = useProfile();
  const { messages, isLoading, sendMessage, cancelStream, clearChat, conversationId, loadConversation } = useDashboardChat();
  const chatHistory = useChatHistory();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Category state
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);



  useEffect(() => {

  const handlePromptSelect = (prompt: string) => {
    setSelectedCategory(null);
    sendMessage(prompt);
  };

  const handleOpenHistory = () => {
    chatHistory.fetchConversations();
    setHistoryOpen(true);
  };

  const handleSelectConversation = (id: string) => {
    loadConversation(id);
  };

  const handleClearChat = () => {
    clearChat();
    chatHistory.fetchConversations();
  };

  // Owner checklist items (preserved)
  const ownerChecklistItems: ChecklistItem[] = [
    { id: "first_flow_created", title: "Create Your First Flow", description: "Set up a flow to track contacts through different stages", completed: ownerOnboarding.progress.first_flow_created, action: { label: "Create Flow", onClick: () => navigate("/") } },
    { id: "pco_connected", title: "Connect Planning Center", description: "Sync your PCO lists and contacts automatically", completed: ownerOnboarding.progress.pco_connected, action: { label: "Connect", onClick: () => navigate("/integrations") } },
    { id: "pco_lists_mapped", title: "Map PCO Lists to Flows", description: "Link your lists to the right flows for automatic sync", completed: ownerOnboarding.progress.pco_lists_mapped, action: { label: "Map Lists", onClick: () => navigate("/integrations") } },
    { id: "team_members_invited", title: "Invite Team Members", description: "Add staff and volunteers to collaborate", completed: ownerOnboarding.progress.team_members_invited, action: { label: "Invite", onClick: () => navigate("/team") } },
    { id: "flow_owners_assigned", title: "Assign Flow Owners", description: "Designate team members to manage specific flows", completed: ownerOnboarding.progress.flow_owners_assigned, action: { label: "Assign", onClick: () => navigate("/") } },
  ];

  const memberChecklistItems: ChecklistItem[] = [
    { id: "profile_completed", title: "Complete Your Profile", description: "Add your name and photo so your team recognizes you", completed: memberOnboarding.progress.profile_completed, action: { label: "Update Profile", onClick: () => navigate("/profile") } },
    { id: "flows_reviewed", title: "Review Your Flows", description: "See which ministry areas you'll help manage", completed: memberOnboarding.progress.flows_reviewed },
    { id: "first_interaction", title: "Explore a People", description: "Click a card to view details and next steps for that person.", completed: memberOnboarding.progress.first_interaction },
  ];

  const shouldShowOnboarding = isInitialLoadComplete && (isOwner
    ? !ownerOnboarding.isCompleted && !ownerOnboarding.isLoading
    : !memberOnboarding.isCompleted && !memberOnboarding.isDismissed && !memberOnboarding.isLoading);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={`Welcome back, ${profile?.full_name || "there"}!`} showAddButton={false} showFlowIcon={false} />

      <PcoPersonalConnectPrompt />

      {shouldShowOnboarding && (
        <OnboardingProgressBar
          currentStep={isOwner ? ownerOnboarding.currentStep : memberOnboarding.currentStep}
          totalSteps={isOwner ? ownerOnboarding.totalSteps : memberOnboarding.totalSteps}
          completedSteps={isOwner ? ownerOnboarding.completedSteps : memberOnboarding.completedSteps}
          onDismiss={!isOwner ? memberOnboarding.dismissOnboarding : undefined}
        />
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-6">
          {/* Onboarding Checklist */}
          {shouldShowOnboarding && (
            <OnboardingChecklist
              title={isOwner ? "Get Your Organization Ready" : "Get Started with FlowLeed"}
              description={isOwner ? "Complete these steps to set up your organization" : "Complete these steps to start serving your community"}
              checklist={isOwner ? ownerChecklistItems : memberChecklistItems}
            />
          )}

          {/* AI Hero Section - shown when no messages */}
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center pt-8 pb-4 space-y-6 relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenHistory}
                className="absolute top-2 right-0 text-xs text-muted-foreground gap-1.5"
              >
                <History className="h-3.5 w-3.5" />
                History
              </Button>
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  How can I help you today?
                </h2>
                <p className="text-muted-foreground text-sm max-w-md text-center">
                  Ask me about your people, tasks, church health, or anything else. I have access to all your FlowLeed data.
                </p>
              </div>
            </div>
          )}

          {/* Chat Input - hero state only */}
          {!hasMessages && (
            <AIChatInput
              onSubmit={sendMessage}
              isLoading={isLoading}
              onCancel={cancelStream}
              hasMessages={false}
            />
          )}

          {/* Category Chips - hidden when streaming */}
          {!hasMessages && !isLoading && (
            <CategoryChips selected={selectedCategory} onSelect={setSelectedCategory} />
          )}

          {/* Suggested Prompts */}
          {!hasMessages && selectedCategory && !isLoading && (
            <SuggestedPrompts
              category={selectedCategory}
              onSelect={handlePromptSelect}
              onClose={() => setSelectedCategory(null)}
            />
          )}

          {/* Chat Thread */}
          <ChatThread messages={messages} isLoading={isLoading} onClear={handleClearChat} onOpenHistory={handleOpenHistory} />
        </div>
      </div>

      {/* Sticky bottom input - shown during active conversation */}
      {hasMessages && (
        <div className="border-t bg-background px-3 md:px-6 py-3 md:py-4">
          <AIChatInput
            onSubmit={sendMessage}
            isLoading={isLoading}
            onCancel={cancelStream}
            hasMessages={true}
          />
        </div>
      )}

      {/* Onboarding Wizards (preserved) */}
      <OwnerOnboardingWizard open={showOwnerWizard} onOpenChange={setShowOwnerWizard} progress={ownerOnboarding.progress} />
      <MemberOnboardingWizard open={showMemberWizard} onOpenChange={setShowMemberWizard} progress={memberOnboarding.progress} />

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

      {/* Chat History Drawer */}
      <ChatHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        conversations={chatHistory.conversations}
        isLoading={chatHistory.isLoading}
        onSelect={handleSelectConversation}
        onDelete={chatHistory.deleteConversation}
        activeConversationId={conversationId}
      />
    </div>
  );
};

export default Dashboard;
