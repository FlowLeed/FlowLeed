import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FlowIconBadge } from "@/components/search/FlowIconBadge";

interface ContactsTableProps {
  contacts: any[];
  isLoading: boolean;
  hasActiveFilters: boolean;
}

export const ContactsTable = ({ contacts, isLoading, hasActiveFilters }: ContactsTableProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <div className="p-8 text-center text-muted-foreground">
          Loading contacts...
        </div>
      </Card>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <Card>
        <div className="p-8 text-center">
          <p className="text-muted-foreground font-light">
            {hasActiveFilters
              ? "No contacts match your filters. Try adjusting your search criteria."
              : "No contacts yet. Add your first contact to get started!"}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Flows</TableHead>
            <TableHead>Last Interaction</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => navigate(`/contacts/${contact.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={contact.avatar} />
                    <AvatarFallback>
                      {contact.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{contact.name}</span>
                </div>
              </TableCell>
              <TableCell className="font-light">{contact.email || "-"}</TableCell>
              <TableCell className="font-light">{contact.phone || "-"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {contact.contact_tags?.slice(0, 3).map((tagObj: any, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {tagObj.tag}
                    </Badge>
                  ))}
                  {contact.contact_tags?.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{contact.contact_tags.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {contact.profiles ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={contact.profiles.avatar_url} />
                      <AvatarFallback>
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-light">
                      {contact.profiles.full_name}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {contact.pipeline_contacts?.slice(0, 2).map((pc: any, idx: number) => (
                    <FlowIconBadge
                      key={idx}
                      flow={{
                        icon: pc.pipelines?.icon || 'Users',
                        name: pc.pipelines?.name || 'Unknown'
                      }}
                      size="sm"
                    />
                  ))}
                  {contact.pipeline_contacts?.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{contact.pipeline_contacts.length - 2}
                    </Badge>
                  )}
                  {(!contact.pipeline_contacts || contact.pipeline_contacts.length === 0) && (
                    <span className="text-muted-foreground text-sm">No flows</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-light text-sm">
                {contact.lastInteraction
                  ? formatDistanceToNow(new Date(contact.lastInteraction), {
                      addSuffix: true,
                    })
                  : "Never"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/contacts/${contact.id}`);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
