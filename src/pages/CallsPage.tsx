import { useState } from "react";
import { CallsList } from "@/components/calls/CallsList";
import { CallDetails } from "@/components/calls/CallDetails";
import { getCalls, getCallById } from "@/data/mockCalls";
import { Phone } from "lucide-react";

const CallsPage = () => {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const calls = getCalls();
  const selectedCall = selectedCallId ? getCallById(selectedCallId) : null;

  return (
    <div className="flex h-full">
      {/* Calls List - Left Panel */}
      <div className="w-72 flex-shrink-0">
        <CallsList
          calls={calls}
          selectedCallId={selectedCallId}
          onSelectCall={setSelectedCallId}
        />
      </div>

      {/* Call Details - Right Panel */}
      <div className="flex-1">
        {selectedCall ? (
          <CallDetails call={selectedCall} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Phone className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a call to view details</p>
            <p className="text-sm mt-2">Choose from your call history on the left</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallsPage;
