import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { ContentChat } from "@/components/content/ContentChat";

export default function ContentChatPage() {
  const { organization } = useProfile();
  const navigate = useNavigate();
  if (!organization) return null;
  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-4xl py-10 px-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} size="sm" className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <header className="space-y-2">
          <h1 className="text-3xl font-light">Chat with your library</h1>
          <p className="text-muted-foreground">Ask anything — answers are grounded in your ingested videos.</p>
        </header>
        <ContentChat organizationId={organization.id} />
      </div>
    </div>
  );
}
