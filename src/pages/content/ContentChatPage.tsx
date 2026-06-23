import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { ContentChat } from "@/components/content/ContentChat";
import { Header } from "@/components/layout/Header";

export default function ContentChatPage() {
  const { organization } = useProfile();
  const navigate = useNavigate();
  if (!organization) return null;
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Chat with your library"
        showFlowIcon={false}
        showAddButton={false}
        showBackButton
        onBackClick={() => navigate(-1)}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl py-10 px-6 space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-light">Chat with your library</h1>
            <p className="text-muted-foreground">Ask anything — answers are grounded in your ingested videos.</p>
          </header>
          <ContentChat organizationId={organization.id} />
        </div>
      </div>
    </div>
  );
}
