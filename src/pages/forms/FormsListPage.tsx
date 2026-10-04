import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ExternalLink, Copy, ClipboardList, Inbox } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { publicUrl as buildPublicUrl } from "@/lib/publicUrl";

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function FormsListPage() {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const orgSlug = organization?.slug;
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: forms, isLoading } = useQuery({
    queryKey: ["forms", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, name, slug, is_published, submission_count, updated_at")
        .eq("organization_id", orgId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No org");
      const base = slugify(name) || "form";
      // Find a unique slug within this org — try plain, then plain-2, plain-3, …
      let slug = base;
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
        const { data: existing } = await supabase
          .from("forms")
          .select("id")
          .eq("organization_id", orgId)
          .eq("slug", candidate)
          .maybeSingle();
        if (!existing) {
          slug = candidate;
          break;
        }
      }
      const { data, error } = await supabase
        .from("forms")
        .insert({ organization_id: orgId, name: name.trim(), slug })
        .select("id")
        .single();
      if (error) throw error;
      // Seed default fields
      await supabase.from("form_fields").insert([
        { form_id: data.id, field_key: "first_name", label: "First Name", field_type: "text", required: true, sort_order: 0 },
        { form_id: data.id, field_key: "last_name", label: "Last Name", field_type: "text", required: true, sort_order: 1 },
        { form_id: data.id, field_key: "email", label: "Email", field_type: "email", required: true, sort_order: 2 },
        { form_id: data.id, field_key: "phone", label: "Phone", field_type: "phone", required: false, sort_order: 3 },
      ]);
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["forms", orgId] });
      setOpen(false);
      setName("");
      nav(`/forms/${id}`);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const publicUrl = (slug: string) =>
    buildPublicUrl(orgSlug ? `/${orgSlug}/f/${slug}` : `/f/${slug}`);

  const copyLink = (slug: string) => {
    const url = publicUrl(slug);
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: url });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header
        title="Forms"
        rightContent={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New form
          </Button>
        }
      />


      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !forms || forms.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No forms yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first public form.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New form
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 max-w-4xl">
            {forms.map((f: any) => (
              <Card key={f.id} className="hover:bg-accent/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/forms/${f.id}`} className="font-medium hover:underline truncate">
                        {f.name}
                      </Link>
                      {f.is_published ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{orgSlug ? `/${orgSlug}/f/${f.slug}` : `/f/${f.slug}`}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copyLink(f.slug)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={publicUrl(f.slug)} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/forms/${f.id}/submissions`}>
                        <Inbox className="h-4 w-4 mr-1" />
                        {f.submission_count || 0}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New form</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Form name (e.g. Connect Card)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
