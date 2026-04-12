import React from "react";
import { type Category } from "./CategoryChips";
import { ArrowRight, X } from "lucide-react";

interface SuggestedPromptsProps {
  category: Category;
  onSelect: (prompt: string) => void;
  onClose: () => void;
}

const promptsByCategory: Record<Category, { emoji: string; title: string; prompts: string[] }> = {
  people: {
    emoji: "👥",
    title: "People",
    prompts: [
      "Show me people at risk of slipping away",
      "Who needs follow-up this week?",
      "Show first-time guests from this weekend",
      "Who hasn't received a second contact yet?",
    ],
  },
  numbers: {
    emoji: "📊",
    title: "Numbers",
    prompts: [
      "Summarize church health this month",
      "Show attendance trends",
      "How many new contacts this week?",
      "Which flows have the most people?",
    ],
  },
  team: {
    emoji: "👤",
    title: "Team",
    prompts: [
      "Show leaders who need support",
      "Who on my team has the most contacts?",
      "What follow-ups are overdue for my team?",
      "How is my team performing this week?",
    ],
  },
  care: {
    emoji: "🙏",
    title: "Care",
    prompts: [
      "Show urgent prayer requests",
      "Who is in hospital or crisis?",
      "What care follow-ups are overdue?",
      "List people who need pastoral visits",
    ],
  },
};

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ category, onSelect, onClose }) => {
  const data = promptsByCategory[category];

  return (
    <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <span className="text-sm font-semibold flex items-center gap-2">
            <span>{data.emoji}</span>
            {data.title}
          </span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2">
          {data.prompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSelect(prompt)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <span>{prompt}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
