import { ChatThread } from "@/components/dashboard/ChatThread";

// Temporary visual harness for chat action-card spacing. Remove after verification.
const noteId = "harness-note-1";
const taskId = "harness-task-1";
const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const messages = [
  {
    role: "user" as const,
    content: "I talked with Sandra Lester-James... lost her job... Keep this private. Remind me Wednesday...",
  },
  {
    role: "assistant" as const,
    content: `<!--flowleed:action={"id":"${noteId}","type":"create_contact_note","summary":"Private note for Sandra Lester-James","expires_at":"${exp}"}-->
### Private Note

The note about her job loss is set to be saved as a private entry on her profile.

<!--flowleed:action={"id":"${taskId}","type":"create_task","summary":"Reminders for Sandra Lester-James","expires_at":"${exp}"}-->
### Reminders

I have scheduled the first reminder for this Wednesday, October 7th, to ask about her resume. The second reminder is set for October 23rd to follow up on her progress in a few weeks.

You can confirm these actions below.🙏`,
  },
];

export default function ChatSpacingDev() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <ChatThread
          messages={messages}
          isLoading={false}
          onClear={() => {}}
          onConfirmAction={async () => ({ ok: true, message: "ok" })}
        />
      </div>
    </div>
  );
}
