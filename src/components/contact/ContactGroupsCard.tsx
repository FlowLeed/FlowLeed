import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsersRound, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface Props { contactId: string }

const roleLabel = (r: string) =>
  r === "leader" ? "Leader" : r === "co_leader" ? "Co-Leader" : r === "host" ? "Host" : "Member";

const roleVariant = (r: string): "default" | "secondary" | "outline" =>
  r === "leader" || r === "co_leader" ? "default" : r === "host" ? "secondary" : "outline";

export function ContactGroupsCard({ contactId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["contact-groups", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          id, role, joined_at, last_attended_at, attendance_count,
          group:groups (id, name, image_url, group_type, pco_group_id, location, meeting_day, status, archived_at)
        `)
        .eq("contact_id", contactId)
        .eq("status", "active")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter((m: any) => m.group && !m.group.archived_at);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UsersRound className="h-4 w-4" /> Groups</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersRound className="h-4 w-4" /> Groups
          {data && data.length > 0 && <Badge variant="secondary">{data.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not in any groups yet.</p>
        ) : (
          <div className="space-y-3">
            {data.map((m: any) => (
              <Link
                key={m.id}
                to={`/groups/${m.group.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {m.group.image_url ? (
                    <img src={m.group.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                      <UsersRound className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.group.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={roleVariant(m.role)} className="h-4 px-1.5 text-[10px]">{roleLabel(m.role)}</Badge>
                      {m.group.pco_group_id && <span className="text-[10px]">· PCO</span>}
                      {m.attendance_count > 0 && <span>· {m.attendance_count} attended</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  {m.last_attended_at ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(m.last_attended_at), { addSuffix: true })}</span>
                    </div>
                  ) : (
                    <span>No attendance yet</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
