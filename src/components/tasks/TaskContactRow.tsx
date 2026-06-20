import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { iconMap } from "@/lib/flowIcons";
import type { TaskContact } from "@/hooks/useTasksPageData";
import { useEngagementScore } from "@/hooks/useCheckinData";
import { EngagementBadge } from "@/components/contact/EngagementBadge";

type RowContact = TaskContact & { campusName?: string | null };

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const TaskContactRow = ({ contact }: { contact: TaskContact }) => {
  const FlowIcon = contact.flowIcon && iconMap[contact.flowIcon] ? iconMap[contact.flowIcon] : null;
  const { data: engagementScore } = useEngagementScore(contact.id);

  return (
    <Link
      to={`/contacts/${contact.id}`}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={contact.avatar || undefined} />
          <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{contact.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {contact.flowName && (
              <Badge variant="outline" className="text-xs gap-1 font-normal">
                {FlowIcon && <FlowIcon className="h-3 w-3" />}
                {contact.flowName}
              </Badge>
            )}
            {contact.stageName && (
              <Badge
                variant="secondary"
                className="text-xs font-normal"
                style={contact.stageColor ? { borderLeft: `3px solid ${contact.stageColor}` } : undefined}
              >
                {contact.stageName}
              </Badge>
            )}
            {contact.nextStageName && (
              <span className="text-xs text-muted-foreground">→ {contact.nextStageName}</span>
            )}
            <EngagementBadge score={engagementScore} compact />
          </div>
        </div>
      </div>
      <Badge
        variant={
          contact.daysSinceLastContact >= 30
            ? "destructive"
            : contact.daysSinceLastContact >= 14
            ? "secondary"
            : "outline"
        }
        className="shrink-0 ml-2"
      >
        {contact.daysSinceLastContact === 999 ? "No contact" : `${contact.daysSinceLastContact}d ago`}
      </Badge>
    </Link>
  );
};
