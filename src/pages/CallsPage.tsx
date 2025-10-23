import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { CallsList } from "@/components/calls/CallsList";
import { CallDetails } from "@/components/calls/CallDetails";
import { Phone } from "lucide-react";
import { useCalls } from "@/hooks/useCalls";
import { CallRecord, CallType, CallStatus } from "@/types/calls";

const CallsPage = () => {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const { calls: rawCalls, isLoading } = useCalls();

  // Transform CallWithContact to CallRecord format
  const calls: CallRecord[] = rawCalls.map(call => ({
    id: call.id,
    contactId: call.contact_id,
    contactName: call.contactName,
    contactAvatar: call.contactAvatar,
    callType: call.direction as CallType,
    status: call.status as CallStatus,
    duration: call.duration || undefined,
    timestamp: new Date(call.created_at),
    phoneNumber: call.phoneNumber,
  }));

  const selectedCall = selectedCallId 
    ? calls.find(call => call.id === selectedCallId) || null
    : null;

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Calls" 
        showFlowIcon={false}
        showAddButton={false}
      />
      <div className="flex flex-1 overflow-auto">
        {/* Calls List - Left Panel */}
        <div className="w-72 flex-shrink-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <CallsList
            calls={calls}
            selectedCallId={selectedCallId}
            onSelectCall={setSelectedCallId}
          />
        )}
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
    </div>
  );
};

export default CallsPage;
