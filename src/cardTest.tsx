import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ContactCard } from "@/components/crm/ContactCard";

const contact = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Kelly Stanley",
  avatar: null,
  tags: ["Worship"],
  email: "kelly@example.com",
  phone: "+15551234567",
  stageEnteredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  campusName: "Santa Rosa",
  assignedTo: { name: "Ruthy Merlos", avatar: null },
} as any;

function Test() {
  const [selected, setSelected] = React.useState(false);
  return (
    <div style={{ width: 300, padding: 24 }}>
      <button id="toggle-select" onClick={() => setSelected((s) => !s)}>
        toggle select
      </button>
      <div id="card-host">
        <ContactCard
          contact={contact}
          pipelineId="pipe-1"
          isSelectMode
          isSelected={false}
          onToggleSelect={() => setSelected((s) => !s)}
        />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Test />
    </BrowserRouter>
  </React.StrictMode>
);
