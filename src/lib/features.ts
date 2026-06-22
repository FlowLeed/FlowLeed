import { MessageSquare, Phone, Sparkles, Activity, type LucideIcon } from "lucide-react";

export type FeatureKey = "texting" | "calling" | "flowleed_ai" | "signals";

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
];

export const FEATURE_KEYS = FEATURE_MODULES.map((f) => f.key);
