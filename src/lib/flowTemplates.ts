export interface FlowTemplateStage {
  name: string;
  color: string;
  isStartStep?: boolean;
  isEndStep?: boolean;
}

export interface FlowTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  recommended?: boolean;
  stages: FlowTemplateStage[];
}

/**
 * Starter flow templates. These are NOT auto-created for new organizations —
 * they are offered as an explicit choice (Set Up My Church, or New Flow).
 */
export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    key: "plan_your_visit",
    name: "Plan Your Visit",
    description:
      "Welcome people who plan a visit: confirm by text, send details, assign a host, then follow up after they attend.",
    icon: "Calendar",
    stages: [
      { name: "Form Submitted", color: "#3b82f6", isStartStep: true },
      { name: "Confirmation Texted", color: "#f59e0b" },
      { name: "Email With Details", color: "#ef4444" },
      { name: "Host Assigned", color: "#10b981" },
      { name: "Attended", color: "#f97316", isEndStep: true },
      { name: "Follow-Up", color: "#eab308" },
      { name: "Moved to Guest", color: "#84cc16" },
    ],
  },
  {
    key: "new_guest_follow_up",
    name: "New Guest Follow-Up",
    description:
      "Follow up with first-time guests: a thank-you text within 24 hours, a welcome call, and an invite to get connected.",
    icon: "HeartHandshake",
    recommended: true,
    stages: [
      { name: "New Guest", color: "#3b82f6", isStartStep: true },
      { name: "Thank You Text", color: "#f59e0b" },
      { name: "Welcome Call", color: "#10b981" },
      { name: "Follow Up", color: "#ef4444" },
      { name: "Meet for Coffee", color: "#f97316" },
      { name: "Connected", color: "#6366f1", isEndStep: true },
    ],
  },
  {
    key: "new_believer_journey",
    name: "New Believer Journey",
    description:
      "Walk new believers from decision to discipleship: follow-up, devotionals, baptism invite, and a mentor.",
    icon: "Star",
    stages: [
      { name: "Decision Made", color: "#3b82f6", isStartStep: true },
      { name: "Follow-Up", color: "#eab308" },
      { name: "Devotional Sent", color: "#22c55e" },
      { name: "Baptism Invite Sent", color: "#f59e0b" },
      { name: "Mentor Assigned", color: "#ef4444" },
      { name: "Growing", color: "#f97316", isEndStep: true },
    ],
  },
  {
    key: "pastoral_care",
    name: "Pastoral Care",
    description:
      "Track care requests from the moment they come in through prayer, a pastor conversation, and follow-up.",
    icon: "Heart",
    recommended: true,
    stages: [
      { name: "Request Received", color: "#3b82f6", isStartStep: true },
      { name: "Pastor Assigned", color: "#10b981" },
      { name: "Care Given", color: "#ef4444" },
      { name: "Follow-Up", color: "#f59e0b" },
      { name: "Done", color: "#8b5cf6", isEndStep: true },
    ],
  },
  {
    key: "baptism",
    name: "Baptism",
    description:
      "Move people from interest in baptism through class, scheduling, the baptism itself, and follow-up care.",
    icon: "Waves",
    recommended: true,
    stages: [
      { name: "Interested", color: "#3b82f6", isStartStep: true },
      { name: "Info Sent", color: "#f59e0b" },
      { name: "Class Scheduled", color: "#10b981" },
      { name: "Date Confirmed", color: "#6366f1" },
      { name: "Baptized", color: "#22c55e", isEndStep: true },
      { name: "Follow-Up Care", color: "#ef4444" },
    ],
  },
  {
    key: "first_time_giver",
    name: "First-Time Giver",
    description:
      "Thank first-time givers, share the story of what their giving does, and invite them into generosity.",
    icon: "Gift",
    stages: [
      { name: "First Gift", color: "#3b82f6", isStartStep: true },
      { name: "Thank You Sent", color: "#f59e0b" },
      { name: "Impact Story Shared", color: "#10b981" },
      { name: "Personal Note", color: "#ef4444" },
      { name: "Recurring Giver", color: "#22c55e", isEndStep: true },
    ],
  },
  {
    key: "volunteer_onboarding",
    name: "Volunteer Onboarding",
    description:
      "Guide people who want to serve: interview, background check, team placement, training, and first serve.",
    icon: "Users",
    stages: [
      { name: "Interested", color: "#3b82f6", isStartStep: true },
      { name: "Interview", color: "#f59e0b" },
      { name: "Background Check", color: "#ef4444" },
      { name: "Team Placed", color: "#10b981" },
      { name: "Trained", color: "#6366f1" },
      { name: "Serving", color: "#22c55e", isEndStep: true },
    ],
  },
];
