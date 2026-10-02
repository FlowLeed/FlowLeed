import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { ChatThread } from "@/components/dashboard/ChatThread";
const content = `I have prepared a private note.🙏\n\n<!--flowleed:action={"id":"a849325f-934b-40d4-88e4-32165a35d9a6","type":"create_contact_note","summary":"Sandra Lester-James • general • Private\\n\\nShe lost her job.","expires_at":"2099-10-02T20:14:41.902Z"}--><!--flowleed:action={"id":"18eac66c-0d6b-4a3c-8bb3-737a61d2fe4e","type":"create_task","summary":"Ask how the resume is going","expires_at":"2099-10-02T20:14:43.063Z"}-->`;
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}><BrowserRouter>
    <ChatThread messages={[{ role: "user", content: "hi" }, { role: "assistant", content }]} isLoading={false} onClear={() => {}} onConfirmAction={async () => ({ ok: true, message: "" })} />
  </BrowserRouter></QueryClientProvider>
);
