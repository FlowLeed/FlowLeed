import { MessageSquare, Phone, Sparkles, Activity, Film, Wand2, Bot, ClipboardList, Radio, type LucideIcon } from "lucide-react";

export type FeatureKey = "texting" | "calling" | "flowleed_ai" | "signals" | "content" | "custom_signals" | "signal_agent" | "forms" | "church_online";


export interface FeatureModule {
  key: FeatureKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** When false, the module is OFF unless explicitly enabled for the org. */
  defaultEnabled?: boolean;
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
  {
    key: "custom_signals",
    label: "Custom Signals",
    description: "Let pastors build their own engagement signals with AND/OR rules.",
    icon: Wand2,
  },
  {
    key: "signal_agent",
    label: "AI Signal Agent",
    description: "AI Staff Pastor that watches signals and proposes actions (notify, add to flow, task, draft message) for human approval.",
    icon: Bot,
  },
  {
    key: "forms",
    label: "Forms",
    description: "Public forms and lead capture with routing into Flows.",
    icon: ClipboardList,
  },
  {
    key: "church_online",
    label: "Church Online Platform",
    description: "Live-stream engagement webhooks (salvations, prayer requests) from Church Online Platform.",
    icon: Radio,
    defaultEnabled: false,
  },
];

/** Feature keys that are OFF by default for every organization. */
export const DEFAULT_OFF_FEATURES: FeatureKey[] = FEATURE_MODULES.filter(
  (m) => m.defaultEnabled === false
).map((m) => m.key);



export const FEATURE_KEYS = FEATURE_MODULES.map((f) => f.key);
