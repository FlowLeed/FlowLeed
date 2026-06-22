import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Lock, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useContentVideo, useContentAnalysis, useContentChunks } from "@/hooks/useContent";
import { formatTimestamp, youtubeEmbedUrl } from "@/lib/contentUtils";
import { ContentChat } from "@/components/content/ContentChat";
import { useIsOrgAdmin } from "@/hooks/useIsOrgAdmin";
import { useAuth } from "@/hooks/useAuth";

export default function ContentVideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const startSeconds = Number(params.get("t") ?? "0");
  const { data: video, isLoading } = useContentVideo(id);
  const { data: analysis } = useContentAnalysis(id);
  const { data: chunks = [] } = useContentChunks(id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isOrgAdmin } = useIsOrgAdmin(user?.id);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const regen = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("content-analyze", {
        body: { videoId: id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Analysis regenerated" });
      qc.invalidateQueries({ queryKey: ["content-analysis", id] });
      qc.invalidateQueries({ queryKey: ["content-video", id] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? String(e), variant: "destructive" }),
  });

  const setConsent = useMutation({
    mutationFn: async (consent_level: "internal_use" | "public_search") => {
      const { error } = await supabase
        .from("content_videos" as any)
        .update({ consent_level })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-video", id] });
      toast({ title: "Visibility updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? String(e), variant: "destructive" }),
  });

  // Postmessage seek
  const seekTo = (seconds: number) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "*",
    );
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "*",
    );
  };

  useEffect(() => {
    if (startSeconds > 0 && iframeRef.current) {
      // give iframe a moment to load
      const t = setTimeout(() => seekTo(startSeconds), 1500);
      return () => clearTimeout(t);
    }
  }, [startSeconds, video?.youtube_id]);

  if (isLoading || !video) {
    return <div className="container max-w-5xl py-10 px-6 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="container max-w-6xl py-10 px-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-light">{video.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{video.channel_name}</span>
          {video.duration_seconds != null && (
            <Badge variant="outline" className="text-xs">{formatTimestamp(video.duration_seconds)}</Badge>
          )}
          {video.ingest_status !== "ready" && video.ingest_status !== "failed" && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {video.ingest_status}
            </Badge>
          )}
          {video.ingest_status === "failed" && (
            <Badge variant="destructive" className="text-xs">Failed: {video.error_message}</Badge>
          )}
        </div>
      </header>

      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          ref={iframeRef}
          src={youtubeEmbedUrl(video.youtube_id, startSeconds || undefined)}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          {isOrgAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          {!analysis ? (
            <Card className="p-6 text-sm text-muted-foreground">
              {video.ingest_status === "ready" ? "No analysis yet." : "Analysis will appear once processing completes."}
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {analysis.impact_score != null && (
                    <Badge variant="secondary">Impact {analysis.impact_score}/10</Badge>
                  )}
                  {analysis.themes?.map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>
                <Button size="sm" variant="ghost" onClick={() => regen.mutate()} disabled={regen.isPending}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${regen.isPending ? "animate-spin" : ""}`} /> Regenerate
                </Button>
              </div>
              <Card className="p-6 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Summary</div>
                <p className="text-base leading-relaxed">{analysis.summary}</p>
              </Card>
              {analysis.story_patterns?.length > 0 && (
                <Card className="p-6 space-y-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Story patterns</div>
                  <div className="space-y-2">
                    {analysis.story_patterns.map((p, i) => (
                      <div key={i}>
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-sm text-muted-foreground">{p.description}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="transcript" className="mt-6">
          <Card className="p-6 max-h-[600px] overflow-y-auto space-y-3">
            {chunks.length === 0 && <div className="text-sm text-muted-foreground">No transcript yet.</div>}
            {chunks.map((c) => (
              <div key={c.id} className="flex gap-3 text-sm">
                <button
                  onClick={() => seekTo(c.start_seconds)}
                  className="text-muted-foreground hover:text-primary font-mono text-xs whitespace-nowrap pt-0.5"
                >
                  {formatTimestamp(c.start_seconds)}
                </button>
                <p className="flex-1 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="mt-6">
          {!analysis?.key_quotes?.length ? (
            <Card className="p-6 text-sm text-muted-foreground">No quotes extracted yet.</Card>
          ) : (
            <div className="space-y-3">
              {analysis.key_quotes.map((q, i) => (
                <Card key={i} className="p-4 flex gap-3">
                  <button
                    onClick={() => seekTo(q.start_seconds)}
                    className="text-xs font-mono text-muted-foreground hover:text-primary whitespace-nowrap"
                  >
                    {formatTimestamp(q.start_seconds)}
                  </button>
                  <p className="flex-1 italic">"{q.text}"</p>
                  <Badge variant="outline">{q.impact_score}/10</Badge>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <ContentChat videoId={video.id} organizationId={video.organization_id} />
        </TabsContent>

        {isOrgAdmin && (
          <TabsContent value="settings" className="mt-6">
            <Card className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-base">Visibility</Label>
                <p className="text-sm text-muted-foreground">
                  Public videos are discoverable on your organization's public Content page.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {video.consent_level === "public_search"
                  ? <Globe className="h-4 w-4 text-primary" />
                  : <Lock className="h-4 w-4 text-muted-foreground" />}
                <Switch
                  checked={video.consent_level === "public_search"}
                  onCheckedChange={(v) => setConsent.mutate(v ? "public_search" : "internal_use")}
                />
                <span className="text-sm">
                  {video.consent_level === "public_search" ? "Public (discoverable)" : "Internal use only"}
                </span>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
