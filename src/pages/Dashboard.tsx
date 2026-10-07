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
import { History, SquarePen } from "lucide-react";
import AiBrandIcon from "@/components/content/AiBrandIcon";
import { Button } from "@/components/ui/button";
import { PcoPersonalConnectPrompt } from "@/components/dashboard/PcoPersonalConnectPrompt";
import { DemoHighlights } from "@/components/demo/DemoHighlights";
import { CareBriefingThread } from "@/components/dashboard/CareBriefingThread";
import { cn } from "@/lib/utils";

type Tab = "briefing" | "chat";
const TAB_KEY = "flowleed:dashboard-tab";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const Dashboard = () => {
  const { profile } = useProfile();
  // Briefing keeps one conversation per local day; tomorrow it starts fresh and today's lives in History.
  const briefing = useDashboardChat({ storageKey: `flowleed:briefing-conv:${today()}`, persistent: true });
  const chat = useDashboardChat();
  const chatHistory = useChatHistory();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tab, setTabState] = useState<Tab>(() => (typeof window !== "undefined" && (localStorage.getItem(TAB_KEY) as Tab)) || "briefing");
  const setTab = (t: Tab) => { setTabState(t); localStorage.setItem(TAB_KEY, t); };
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const openHistory = () => { chatHistory.fetchConversations(); setHistoryOpen(true); };
  const newChat = () => { chat.clearChat(); chatHistory.fetchConversations(); };

  const active = tab === "briefing" ? briefing : chat;
  const chatHasMessages = chat.messages.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Header title={`Welcome back, ${profile?.full_name || "there"}!`} showAddButton={false} showFlowIcon={false} />
      <PcoPersonalConnectPrompt />

      {/* Segmented switcher */}
      <div className="flex items-center justify-center px-3 pt-3 md:px-6 relative">
        <div role="tablist" className="inline-flex rounded-full bg-muted p-1">
          {(["briefing", "chat"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-5 py-1.5 text-sm font-medium transition-colors",
                tab === t ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "briefing" ? "Briefing" : "Chat"}
            </button>
          ))}
        </div>
        {tab === "chat" && (
          <div className="absolute right-3 md:right-6 flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={openHistory} aria-label="History" title="History">
              <History className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={newChat} aria-label="New chat" title="New chat">
              <SquarePen className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain hide-scrollbar">
        <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-6">
          {tab === "briefing" ? (
            <>
              <CareBriefingThread onAsk={briefing.sendMessage} />
              <DemoHighlights />
              {briefing.messages.length > 0 && (
                <ChatThread
                  messages={briefing.messages}
                  isLoading={briefing.isLoading}
                  onConfirmAction={briefing.confirmAction}
                  renderBriefing={() => <CareBriefingThread onAsk={briefing.sendMessage} inThread />}
                />
              )}
            </>
          ) : (
            <>
              {!chatHasMessages && (
                <div className="flex flex-col items-center gap-3 pt-8 pb-2">
                  <AiBrandIcon className="h-12 w-12" aria-label="FlowLeed AI" />
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">How can I help you today?</h2>
                  <p className="text-muted-foreground text-sm max-w-md text-center">
                    Ask me about your people, tasks, church health, or anything else.
                  </p>
                </div>
              )}
              {!chatHasMessages && !chat.isLoading && (
                <CategoryChips selected={selectedCategory} onSelect={setSelectedCategory} />
              )}
              {!chatHasMessages && selectedCategory && !chat.isLoading && (
                <SuggestedPrompts
                  category={selectedCategory}
                  onSelect={(p) => { setSelectedCategory(null); chat.sendMessage(p); }}
                  onClose={() => setSelectedCategory(null)}
                />
              )}
              <ChatThread
                messages={chat.messages}
                isLoading={chat.isLoading}
                onConfirmAction={chat.confirmAction}
                renderBriefing={() => <CareBriefingThread onAsk={chat.sendMessage} inThread />}
              />
            </>
          )}
        </div>
      </div>

      {/* Input pinned at the bottom of the active tab */}
      <div className="bg-crm-background px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:px-6 md:py-4">
        <div className="max-w-4xl mx-auto">
          <AIChatInput
            key={tab}
            onSubmit={active.sendMessage}
            isLoading={active.isLoading}
            onCancel={active.cancelStream}
            hasMessages={active.messages.length > 0}
          />
        </div>
      </div>

      <ChatHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        conversations={chatHistory.conversations}
        isLoading={chatHistory.isLoading}
        onSelect={(id) => { chat.loadConversation(id); setTab("chat"); }}
        onDelete={chatHistory.deleteConversation}
        activeConversationId={chat.conversationId}
      />
    </div>
  );
};

export default Dashboard;
