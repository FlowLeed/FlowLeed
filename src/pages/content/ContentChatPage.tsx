import { useProfile } from "@/hooks/useProfile";
import { ContentChat } from "@/components/content/ContentChat";

export default function ContentChatPage() {
  const { organization } = useProfile();
  if (!organization) return null;
  return (
    <div className="container max-w-4xl py-10 px-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-light">Chat with your library</h1>
        <p className="text-muted-foreground">Ask anything — answers are grounded in your ingested videos.</p>
      </header>
      <ContentChat organizationId={organization.id} />
    </div>
  );
}
