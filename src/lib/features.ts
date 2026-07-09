import { MessageSquare, Phone, Sparkles, Activity, Film, Wand2, Bot, type LucideIcon } from "lucide-react";

export type FeatureKey = "texting" | "calling" | "flowleed_ai" | "signals" | "content" | "custom_signals" | "signal_agent";

export interface FeatureModule {
  key: FeatureKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const FEATURE_MODULES: FeatureModule[] = [
  {
    key: "texting",
    label: "Texting",
    description: "SMS conversations and Twilio messaging (Messages page).",
    icon: MessageSquare,
  },
  {
    key: "calling",
    label: "Calling",
    description: "Voice calls and call records (Calls page).",
    icon: Phone,
  },
  {
    key: "flowleed_ai",
    label: "Flowleed AI",
    description: "Conversational AI dashboard, suggestions, and AI drafts.",
    icon: Sparkles,
  },
  {
    key: "signals",
    label: "Signals",
    description: "Engagement signals page and signal chips.",
    icon: Activity,
  },
  {
    key: "content",
    label: "Content",
    description: "Semantic video-story discovery: ingest YouTube videos, extract stories with AI, and search by meaning.",
    icon: Film,
  },
];

export const FEATURE_KEYS = FEATURE_MODULES.map((f) => f.key);
