import { CallRecord } from "@/types/calls";
import { CallDetailsHeader } from "./CallDetailsHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallDetailsProps {
  call: CallRecord;
}

export const CallDetails = ({ call }: CallDetailsProps) => {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Not answered";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const getCallTypeLabel = () => {
    switch (call.callType) {
      case "inbound":
        return "Incoming Call";
      case "outbound":
        return "Outgoing Call";
      case "missed":
        return "Missed Call";
    }
  };

  const getCallIcon = () => {
    switch (call.callType) {
      case "inbound":
        return (
          <PhoneIncoming
            className={cn(
              "h-5 w-5",
              call.status === "answered" ? "text-green-500" : "text-muted-foreground"
            )}
          />
        );
      case "outbound":
        return (
          <PhoneOutgoing
            className={cn(
              "h-5 w-5",
              call.status === "answered" ? "text-blue-500" : "text-muted-foreground"
            )}
          />
        );
      case "missed":
        return <PhoneMissed className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      answered: "default",
      voicemail: "secondary",
      missed: "destructive",
    };

    return (
      <Badge variant={variants[call.status] || "default"}>
        {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <CallDetailsHeader call={call} />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Call Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Call Information</CardTitle>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {getCallIcon()}
                <div>
                  <p className="font-medium">{getCallTypeLabel()}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(call.timestamp, "EEEE, MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>

              {call.phoneNumber && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Phone Number</p>
                    <p className="text-sm text-muted-foreground">{call.phoneNumber}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Duration</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(call.duration)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No notes available for this call. Add notes during or after your calls to keep track of important information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
