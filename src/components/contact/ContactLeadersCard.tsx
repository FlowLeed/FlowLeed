import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ShieldCheck, MessageSquare, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface Props { contactId: string }

const ROLE_PRIORITY: Record<string, number> = { leader: 0, co_leader: 1, host: 2 };
const roleLabel = (r: string) =>
  r === "leader" ? "Leader" : r === "co_leader" ? "Co-Leader" : r === "host" ? "Host" : r;
const roleVariant = (r: string): "default" | "secondary" | "outline" =>
  r === "leader" || r === "co_leader" ? "default" : "secondary";

interface LeaderEntry {
  contact_id: string;
  name: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  groups: string[];
}

export function ContactLeadersCard({ contactId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["contact-leaders", contactId],
    queryFn: async (): Promise<LeaderEntry[]> => {
      // 1. Groups the contact is in (active, not archived)
      const { data: myMemberships, error: e1 } = await supabase
        .from("group_members")
        .select("group_id, group:groups!inner(id, name, archived_at)")
        .eq("contact_id", contactId)
        .eq("status", "active");
      if (e1) throw e1;

      const groups = (myMemberships || [])
        .filter((m: any) => m.group && !m.group.archived_at);
      const groupIds = groups.map((m: any) => m.group_id);
      const groupNameById = new Map<string, string>(
        groups.map((m: any) => [m.group_id, m.group.name])
      );
      if (groupIds.length === 0) return [];

      // 2. Leaders in those groups (excluding self)
      const { data: leaderRows, error: e2 } = await supabase
        .from("group_members")
        .select("contact_id, group_id, role")
        .in("group_id", groupIds)
        .eq("status", "active")
        .in("role", ["leader", "co_leader", "host"])
        .neq("contact_id", contactId);
      if (e2) throw e2;
      if (!leaderRows || leaderRows.length === 0) return [];

      // 3. Contact records for leaders
      const leaderIds = Array.from(new Set(leaderRows.map((r) => r.contact_id).filter(Boolean)));
      const { data: contacts, error: e3 } = await supabase
        .from("contacts")
        .select("id, name, avatar, email, phone")
        .in("id", leaderIds);
      if (e3) throw e3;
      const contactById = new Map((contacts || []).map((c: any) => [c.id, c]));

      // 4. Dedupe by leader contact_id
      const byLeader = new Map<string, LeaderEntry>();
      for (const row of leaderRows) {
        const c: any = contactById.get(row.contact_id);
        if (!c) continue;
        const groupName = groupNameById.get(row.group_id);
        const existing = byLeader.get(row.contact_id);
        if (existing) {
          if (groupName && !existing.groups.includes(groupName)) existing.groups.push(groupName);
          if ((ROLE_PRIORITY[row.role] ?? 99) < (ROLE_PRIORITY[existing.role] ?? 99)) {
            existing.role = row.role;
          }
        } else {
          byLeader.set(row.contact_id, {
            contact_id: row.contact_id,
            name: c.name || "Unknown",
            avatar: c.avatar || null,
            email: c.email || null,
            phone: c.phone || null,
            role: row.role,
            groups: groupName ? [groupName] : [],
          });
        }
      }

      return Array.from(byLeader.values()).sort((a, b) => {
        const rp = (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99);
        if (rp !== 0) return rp;
        return a.name.localeCompare(b.name);
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Leaders
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> Leaders
          <Badge variant="secondary">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((l) => (
            <div
              key={l.contact_id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
            >
              <Link to={`/contacts/${l.contact_id}`} className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-10 w-10 shrink-0">
                  {l.avatar ? <AvatarImage src={l.avatar} alt={l.name} /> : null}
                  <AvatarFallback>{l.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Badge variant={roleVariant(l.role)} className="h-4 px-1.5 text-[10px]">
                      {roleLabel(l.role)}
                    </Badge>
                    {l.groups.length > 0 && (
                      <span className="truncate">Leads: {l.groups.join(", ")}</span>
                    )}
                  </div>
                </div>
              </Link>
              <div className="flex gap-1 shrink-0">
                {l.phone && (
                  <a href={`sms:${l.phone}`} className="p-1.5 hover:bg-muted rounded-full" title="Text">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </a>
                )}
                {l.email && (
                  <a href={`mailto:${l.email}`} className="p-1.5 hover:bg-muted rounded-full" title="Email">
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                )}
                {l.phone && (
                  <a href={`tel:${l.phone}`} className="p-1.5 hover:bg-muted rounded-full" title="Call">
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
