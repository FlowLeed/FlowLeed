import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { useProfile } from "@/hooks/useProfile";
import { AIChatInput } from "@/components/dashboard/AIChatInput";
import { CategoryChips, type Category } from "@/components/dashboard/CategoryChips";
import { SuggestedPrompts } from "@/components/dashboard/SuggestedPrompts";
import { ChatThread } from "@/components/dashboard/ChatThread";
import { useDashboardChat } from "@/hooks/useDashboardChat";
import { useChatHistory } from "@/hooks/useChatHistory";
import { ChatHistoryDrawer } from "@/components/dashboard/ChatHistoryDrawer";
import { Sparkles, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PcoPersonalConnectPrompt } from "@/components/dashboard/PcoPersonalConnectPrompt";
import { DemoHighlights } from "@/components/demo/DemoHighlights";

const Dashboard = () => {
  const { profile } = useProfile();
  const { messages, isLoading, sendMessage, confirmAction, cancelStream, clearChat, conversationId, loadConversation } = useDashboardChat();
  const chatHistory = useChatHistory();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Category state
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

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

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Header title={`Welcome back, ${profile?.full_name || "there"}!`} showAddButton={false} showFlowIcon={false} />

      <PcoPersonalConnectPrompt />

      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain hide-scrollbar">
        <div className="mx-auto max-w-4xl space-y-6 px-3 py-4 md:space-y-4 md:px-5 md:py-4">
          {/* AI Hero Section - shown when no messages */}
          {!hasMessages && (
            <div className="relative flex flex-col items-center justify-center space-y-6 pb-4 pt-8 md:space-y-4 md:pb-2 md:pt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenHistory}
                className="absolute top-2 right-0 text-xs text-muted-foreground gap-1.5"
              >
                <History className="h-3.5 w-3.5" />
                History
              </Button>
              <div className="flex flex-col items-center gap-3 md:gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm md:h-10 md:w-10" aria-label="FlowLeed AI">
                  <Sparkles className="h-7 w-7 text-primary-foreground md:h-6 md:w-6" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-xl">
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

          {/* Sample-data highlights: "here are people who may need attention today" */}
          {!hasMessages && <DemoHighlights />}

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
          <ChatThread messages={messages} isLoading={isLoading} onClear={handleClearChat} onOpenHistory={handleOpenHistory} onConfirmAction={confirmAction} />
        </div>
      </div>

      {/* Sticky bottom input - shown during active conversation */}
      {hasMessages && (
        <div className="border-t bg-background px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:px-5 md:py-3">
          <AIChatInput
            onSubmit={sendMessage}
            isLoading={isLoading}
            onCancel={cancelStream}
            hasMessages={true}
          />
        </div>
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
