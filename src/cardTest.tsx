import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContactCard } from "@/components/crm/ContactCard";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const selectParam = new URLSearchParams(window.location.search).get("select");
const contact = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Kelly Stanley",
  avatar: null,
  tags: ["Worship"],
  email: "kelly@example.com",
  phone: "+15551234567",
  stageEnteredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  campusName: selectParam === "0" ? null : "Santa Rosa",
  assignedTo: { name: "Ruthy Merlos", avatar: null },
} as any;


function Test() {
  const [selectMode, setSelectMode] = React.useState(() => selectParam !== "0");

  const [selected, setSelected] = React.useState(false);
  return (
    <div style={{ width: 300, padding: 24 }}>
      <button id="toggle-select" onClick={() => setSelectMode((s) => !s)}>
        toggle select
      </button>
      <div id="card-host">
        <ContactCard
          contact={contact}
          pipelineId="pipe-1"
          isSelectMode={selectMode}
          isSelected={selected}
          onToggleSelect={() => setSelected((s) => !s)}
        />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Test />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
