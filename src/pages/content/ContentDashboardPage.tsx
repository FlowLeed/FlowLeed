import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Film, Search, Sparkles, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useContentVideos } from "@/hooks/useContent";
import { extractYouTubeId, formatTimestamp } from "@/lib/contentUtils";

export default function ContentDashboardPage() {
  const { organization } = useProfile();
  const { data: videos = [], isLoading } = useContentVideos();
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const ingest = useMutation({
    mutationFn: async (youtubeUrl: string) => {
      if (!organization?.id) throw new Error("No organization");
      if (!extractYouTubeId(youtubeUrl)) throw new Error("Please paste a valid YouTube URL");
      const { data, error } = await supabase.functions.invoke("content-ingest", {
        body: { youtubeUrl, organizationId: organization.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setUrl("");
      toast({ title: "Ingestion started", description: "We'll transcribe, embed and analyze the video." });
      qc.invalidateQueries({ queryKey: ["content-videos"] });
    },
    onError: (e: any) => {
      toast({ title: "Ingestion failed", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  return (
    <div className="container max-w-5xl py-10 px-6 space-y-10">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Film className="h-4 w-4" /> Content
          </div>
          {organization?.slug && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={`/org/${organization.slug}/content`} target="_blank" rel="noreferrer" title="Open public library">
                <ExternalLink className="h-3.5 w-3.5" />
                Public library
              </a>
            </Button>
          )}
        </div>
        <h1 className="text-4xl font-light tracking-tight">Discover the stories inside your videos.</h1>
        <p className="text-muted-foreground max-w-2xl">
          Paste a YouTube URL to ingest, analyze and semantically search any video your team uses.
        </p>
      </header>

      <Card className="p-6 space-y-4">
        <div className="text-sm font-medium">Ingest a video</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (url.trim()) ingest.mutate(url.trim()); }}
        >
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-11"
          />
          <Button type="submit" disabled={ingest.isPending || !url.trim()} className="h-11 px-6">
            {ingest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ingest"}
          </Button>
        </form>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="text-sm font-medium">Search your library</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) window.location.href = `/content/search?q=${encodeURIComponent(query.trim())}`;
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Try: stories about courage, baptism testimonies, leadership advice…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-10"
            />
          </div>
          <Button type="submit" disabled={!query.trim()} className="h-11 px-6">Search</Button>
        </form>
        <div className="flex gap-3 text-sm">
          <Link to="/content/chat" className="text-primary hover:underline inline-flex items-center gap-1">
            <Sparkles className="h-4 w-4" /> Chat across your library
          </Link>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-light">Recent videos</h2>
          <Link to="/content/library" className="text-sm text-muted-foreground hover:text-foreground">View all</Link>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : videos.length === 0 ? (
          <Card className="p-12 text-center space-y-2">
            <Film className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <div className="text-lg font-light">Paste your first YouTube URL above</div>
            <div className="text-sm text-muted-foreground">We'll transcribe, embed and pull out the stories.</div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.slice(0, 9).map((v) => (
              <Link to={`/content/videos/${v.id}`} key={v.id}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  {v.thumbnail_url && (
                    <div className="aspect-video bg-muted overflow-hidden">
                      <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <div className="font-medium line-clamp-2">{v.title ?? "Untitled"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{v.channel_name}</div>
                    <div className="flex items-center gap-2 pt-1">
                      {v.ingest_status !== "ready" && v.ingest_status !== "failed" && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {v.ingest_status}
                        </Badge>
                      )}
                      {v.ingest_status === "failed" && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertCircle className="h-3 w-3" /> Failed
                        </Badge>
                      )}
                      {v.duration_seconds != null && (
                        <span className="text-xs text-muted-foreground">{formatTimestamp(v.duration_seconds)}</span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
