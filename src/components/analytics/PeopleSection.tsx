import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAtRiskContacts } from "@/hooks/useAnalytics";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export const PeopleSection = () => {
  const { data: atRiskContacts, isLoading } = useAtRiskContacts(30);
  const navigate = useNavigate();

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  return (
    <div className="space-y-6">
      {/* At-Risk Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle>At-Risk People</CardTitle>
              <CardDescription>
                People with no interactions in the last 30 days
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last Interaction</TableHead>
                <TableHead className="text-right">Days Inactive</TableHead>
                <TableHead>Flows</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atRiskContacts?.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={contact.avatar || undefined} />
                        <AvatarFallback>
                          {contact.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{contact.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{contact.email || "—"}</TableCell>
                  <TableCell>
                    {contact.lastInteractionDate
                      ? format(new Date(contact.lastInteractionDate), "MMM d, yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="destructive">
                      {contact.daysSinceLastContact || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contact.flows.map((flow: any) => (
                        <Badge key={flow.id} variant="outline" className="text-xs">
                          {flow.name}
                        </Badge>
                      ))}
                      {contact.flows.length === 0 && (
                        <span className="text-sm text-muted-foreground">No flows</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      View Profile
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {atRiskContacts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                      <p>No at-risk people found</p>
                      <p className="text-sm">All people have recent activity!</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
