import { useState } from "react";
import { CallRecord } from "@/types/calls";
import { CallItem } from "./CallItem";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CallsListProps {
  calls: CallRecord[];
  selectedCallId: string | null;
  onSelectCall: (callId: string) => void;
}

export const CallsList = ({
  calls,
  selectedCallId,
  onSelectCall,
}: CallsListProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCalls = calls.filter((call) => {
    const query = searchQuery.toLowerCase();
    return (
      call.contactName.toLowerCase().includes(query) ||
      call.phoneNumber?.toLowerCase().includes(query) ||
      call.contactRole?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full border-r bg-background">
      {/* Search Bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search calls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Calls List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredCalls.map((call) => (
            <CallItem
              key={call.id}
              call={call}
              isSelected={selectedCallId === call.id}
              onClick={() => onSelectCall(call.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
