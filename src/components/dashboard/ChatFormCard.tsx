import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Globe, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Preview / Publish / Copy-link controls for a form FlowLeed AI just created. */
export const ChatFormCard = ({ id, path }: { id: string; path: string }) => {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: form } = useQuery({
    queryKey: ["chat-form", id],
    queryFn: async () => {
      const { data } = await supabase.from("forms").select("id, is_published").eq("id", id).maybeSingle();
      return data;
    },
  });
  const url = `${window.location.origin}${path}`;
  if (form === null) return null;

  const publish = async () => {
    setBusy(true);
    const { data, error } = await supabase.from("forms").update({ is_published: true }).eq("id", id).select("is_published").maybeSingle();
    setBusy(false);
    if (error || !data?.is_published) { toast.error("Couldn't publish this form."); return; }
    qc.setQueryData(["chat-form", id], { id, is_published: true });
    toast.success("Form published");
  };
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="not-prose mt-3 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs">
          <a href={`${path}?preview=1`} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" />Preview</a>
        </Button>
        {form?.is_published ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5" />Published</span>
        ) : (
          <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" disabled={busy || !form} onClick={() => void publish()}>
            <Globe className="h-3.5 w-3.5" />{busy ? "Publishing..." : "Publish"}
          </Button>
        )}
      </div>
      {form?.is_published && (
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{url}</code>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => void copy()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  );
};
