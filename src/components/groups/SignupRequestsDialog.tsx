import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Mail, Phone, Calendar, UserPlus } from "lucide-react";
import { useGroupSignupRequests } from "@/hooks/useGroupSignupRequests";

interface SignupRequestsDialogProps {
  groupId: string;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SignupRequestsDialog = ({
  groupId,
  organizationId,
  open,
  onOpenChange,
}: SignupRequestsDialogProps) => {
  const { requests, isLoading, approveRequest, rejectRequest } = useGroupSignupRequests(groupId);

  const handleApprove = async (request: typeof requests[0]) => {
    await approveRequest.mutateAsync({ request, organizationId });
  };

  const handleReject = async (requestId: string) => {
    await rejectRequest.mutateAsync(requestId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Pending Signup Requests
            {requests.length > 0 && (
              <Badge variant="secondary">{requests.length}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Review and process signup requests for this group
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No pending signup requests</p>
            </div>
          ) : (
            requests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <p className="font-semibold text-lg">{request.name}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {request.email}
                        </span>
                        {request.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {request.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(request.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {request.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          "{request.notes}"
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(request.id)}
                        disabled={rejectRequest.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request)}
                        disabled={approveRequest.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
