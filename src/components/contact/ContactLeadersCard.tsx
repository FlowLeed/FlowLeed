import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ShieldCheck, MessageSquare, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

interface LeadersResult {
  topLeaders: LeaderEntry[];
  allLeaders: LeaderEntry[];
  topGroupNames: string[];
}

function LeaderRow({ l }: { l: LeaderEntry }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors">
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
  );
}

export function ContactLeadersCard({ contactId }: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contact-leaders", contactId],
    queryFn: async (): Promise<LeadersResult> => {
      // 1. Groups the contact is in (active, not archived) with last_attended_at
      const { data: myMemberships, error: e1 } = await supabase
        .from("group_members")
        .select("group_id, last_attended_at, joined_at, group:groups!inner(id, name, archived_at)")
        .eq("contact_id", contactId)
        .eq("status", "active");
      if (e1) throw e1;

      const memberships = (myMemberships || []).filter((m: any) => m.group && !m.group.archived_at);
      if (memberships.length === 0) return { topLeaders: [], allLeaders: [], topGroupNames: [] };

      const groupIds = memberships.map((m: any) => m.group_id);
      const groupNameById = new Map<string, string>(
        memberships.map((m: any) => [m.group_id, m.group.name])
      );

      // Top 5 groups by last_attended_at (nulls last, then joined_at)
      const sortedMemberships = [...memberships].sort((a: any, b: any) => {
        const aAt = a.last_attended_at ? new Date(a.last_attended_at).getTime() : 0;
        const bAt = b.last_attended_at ? new Date(b.last_attended_at).getTime() : 0;
        if (aAt !== bAt) return bAt - aAt;
        const aJ = a.joined_at ? new Date(a.joined_at).getTime() : 0;
        const bJ = b.joined_at ? new Date(b.joined_at).getTime() : 0;
        return bJ - aJ;
      });
      const topGroupIds = new Set(sortedMemberships.slice(0, 5).map((m: any) => m.group_id));
      const topGroupNames = sortedMemberships
        .slice(0, 5)
        .map((m: any) => groupNameById.get(m.group_id))
        .filter(Boolean) as string[];

      // 2. Leaders in those groups (excluding self)
      const { data: leaderRows, error: e2 } = await supabase
        .from("group_members")
        .select("contact_id, group_id, role")
        .in("group_id", groupIds)
        .eq("status", "active")
        .in("role", ["leader", "co_leader", "host"])
        .neq("contact_id", contactId);
      if (e2) throw e2;
      if (!leaderRows || leaderRows.length === 0) {
        return { topLeaders: [], allLeaders: [], topGroupNames };
      }

      // 3. Contact records for leaders
      const leaderIds = Array.from(new Set(leaderRows.map((r) => r.contact_id).filter(Boolean)));
      const { data: contacts, error: e3 } = await supabase
        .from("contacts")
        .select("id, name, avatar, email, phone")
        .in("id", leaderIds);
      if (e3) throw e3;
      const contactById = new Map((contacts || []).map((c: any) => [c.id, c]));

      const buildLeaders = (filterToTop: boolean) => {
        const byLeader = new Map<string, LeaderEntry>();
        for (const row of leaderRows) {
          if (filterToTop && !topGroupIds.has(row.group_id)) continue;
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
      };

      return {
        topLeaders: buildLeaders(true),
        allLeaders: buildLeaders(false),
        topGroupNames,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <ShieldCheck className="h-4 w-4" /> Leaders
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!data || data.allLeaders.length === 0) return null;

  const { topLeaders, allLeaders, topGroupNames } = data;
  const hasMore = allLeaders.length > topLeaders.length;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 text-sm font-medium min-w-0">
          <ShieldCheck className="h-4 w-4 shrink-0" /> Leaders
          <Badge variant="secondary">{allLeaders.length}</Badge>
        </div>
        {hasMore && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                View all
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>All leaders ({allLeaders.length})</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {allLeaders.map((l) => (
                  <LeaderRow key={l.contact_id} l={l} />
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {topGroupNames.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          From most-recently-active groups: {topGroupNames.join(", ")}
        </p>
      )}
      <div className="space-y-3">
        {topLeaders.map((l) => (
          <LeaderRow key={l.contact_id} l={l} />
        ))}
      </div>
    </div>
  );
}
