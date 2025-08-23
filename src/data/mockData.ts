
import { Contact, Pipeline } from "../types/crm";

// Generate a random ID
const generateId = () => Math.random().toString(36).substring(2, 10);

// Mock contact data
const mockContacts: Contact[] = [
  {
    id: generateId(),
    name: "Diana Berigan",
    date: "25 Sep",
    tags: ["active", "partner", "florida"],
    assignedTo: {
      name: "Alex Yarmolati",
    },
    status: "active",
    email: "diana.berigan@example.com",
    phone: "555-1234",
  },
  {
    id: generateId(),
    name: "Anna Shmashina",
    date: "25 Sep",
    tags: ["active", "partner", "florida"],
    assignedTo: {
      name: "Alex Yarmolati",
    },
    status: "active",
    email: "anna.shmashina@example.com",
    phone: "555-5678",
  },
  {
    id: generateId(),
    name: "Justin Case",
    date: "25 Sep",
    tags: ["active", "partner", "florida"],
    assignedTo: {
      name: "Alex Yarmolati",
    },
    status: "active",
    email: "justin.case@example.com",
    phone: "555-9012",
  },
];

// Create more contacts by duplicating and modifying existing ones
const createMoreContacts = (count: number): Contact[] => {
  const result: Contact[] = [];
  for (let i = 0; i < count; i++) {
    const baseContact = mockContacts[i % mockContacts.length];
    result.push({
      ...baseContact,
      id: generateId(),
    });
  }
  return result;
};

// Create pipelines with contacts distributed across stages
export const hostTeamPipeline: Pipeline = {
  id: "host-team",
  name: "Host Team Launch",
  stages: [
    {
      id: "interest",
      name: "Interest",
      contacts: [...createMoreContacts(3)],
      color: "#3B82F6", // blue
    },
    {
      id: "interview",
      name: "Interview",
      contacts: [...createMoreContacts(3)],
      color: "#F59E0B", // yellow
    },
    {
      id: "orientation",
      name: "Orientation",
      contacts: [...createMoreContacts(4)],
      color: "#10B981", // green
    },
    {
      id: "first-month",
      name: "1st Month Serving",
      contacts: [...createMoreContacts(3)],
      color: "#8B5CF6", // purple
    },
  ],
};

export const pastoralCarePipeline: Pipeline = {
  id: "pastoral-care",
  name: "Pastoral Care",
  stages: [
    {
      id: "new",
      name: "New",
      contacts: [...createMoreContacts(3)],
      color: "#EF4444", // red
    },
    {
      id: "connect",
      name: "Connect",
      contacts: [...createMoreContacts(3)],
      color: "#F59E0B", // yellow
    },
    {
      id: "response-plan",
      name: "Response Plan",
      contacts: [...createMoreContacts(4)],
      color: "#3B82F6", // blue
    },
    {
      id: "follow-up",
      name: "Follow-Up/Check-In",
      contacts: [...createMoreContacts(2)],
      color: "#10B981", // green
    },
    {
      id: "integration",
      name: "Integration",
      contacts: [...createMoreContacts(2)],
      color: "#8B5CF6", // purple
    },
  ],
};

export const operationsPipeline: Pipeline = {
  id: "operations",
  name: "Operations",
  stages: [
    {
      id: "new-request",
      name: "New Request",
      contacts: [...createMoreContacts(2)],
      color: "#06B6D4", // cyan
    },
    {
      id: "in-progress",
      name: "In Progress",
      contacts: [...createMoreContacts(3)],
      color: "#F59E0B", // yellow
    },
    {
      id: "review",
      name: "Review",
      contacts: [...createMoreContacts(1)],
      color: "#8B5CF6", // purple
    },
    {
      id: "completed",
      name: "Completed",
      contacts: [...createMoreContacts(2)],
      color: "#10B981", // green
    },
  ],
};

export const givingHubPipeline: Pipeline = {
  id: "giving-hub",
  name: "Giving Hub",
  stages: [
    {
      id: "inquiry",
      name: "Inquiry",
      contacts: [...createMoreContacts(3)],
      color: "#EC4899", // pink
    },
    {
      id: "meeting",
      name: "Meeting",
      contacts: [...createMoreContacts(2)],
      color: "#F59E0B", // yellow
    },
    {
      id: "proposal",
      name: "Proposal",
      contacts: [...createMoreContacts(1)],
      color: "#8B5CF6", // purple
    },
    {
      id: "commitment",
      name: "Commitment",
      contacts: [...createMoreContacts(2)],
      color: "#10B981", // green
    },
  ],
};

export const pipelines = [hostTeamPipeline, pastoralCarePipeline, operationsPipeline, givingHubPipeline];
