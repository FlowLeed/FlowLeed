import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function FormSubmissionsPage() {
  const { id } = useParams();

  const { data: form } = useQuery({
    queryKey: ["form", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("id, name").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["form-submissions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("id, data, created_at, contact_id, contacts(name)")
        .eq("form_id", id!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title={form?.name ? `${form.name} — Submissions` : "Submissions"} />
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full">
        <Button variant="ghost" size="sm" asChild className="mb-3">
          <Link to={`/forms/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to form
          </Link>
        </Button>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !submissions || submissions.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No submissions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s: any) => (
              <Card key={s.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">
                      {s.contact_id ? (
                        <Link to={`/contacts/${s.contact_id}`} className="hover:underline">
                          {s.contacts?.name || "View contact"}
                        </Link>
                      ) : (
                        "Anonymous"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {Object.entries(s.data || {}).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted-foreground">{k}: </span>
                        <span>{Array.isArray(v) ? v.join(", ") : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
