import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Contact {
  id: string;
  name: string;
  avatar: string | null;
  daysSinceLastContact: number;
  flow: { name: string; icon?: string } | null;
  campusName?: string | null;
}

interface ContactsNeedingAttentionProps {
  contacts: Contact[];
  loading?: boolean;
}

const getInitials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const ContactsNeedingAttention = ({
  contacts,
  loading,
}: ContactsNeedingAttentionProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-light">People I Need to Connect With</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-light">People I Need to Connect With</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You're all caught up! No one needs immediate attention. 🎉
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-light">People I Need to Connect With</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contacts.map((contact) => (
          <Link
            key={contact.id}
            to={`/contacts/${contact.id}`}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-10 w-10">
                <AvatarImage src={contact.avatar || undefined} />
                <AvatarFallback>
                  {getInitials(contact.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{contact.name}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant={
                  contact.daysSinceLastContact >= 30
                    ? "destructive"
                    : contact.daysSinceLastContact >= 14
                    ? "secondary"
                    : "outline"
                }
              >
                {contact.daysSinceLastContact === 999
                  ? "No contact"
                  : `${contact.daysSinceLastContact}d ago`}
              </Badge>
            </div>
          </Link>
        ))}
        <div className="pt-2">
          <Link to="/tasks">
            <Button variant="ghost" className="w-full justify-between">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
