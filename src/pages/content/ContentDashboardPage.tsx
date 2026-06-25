import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Film, Search, Sparkles, Loader2, AlertCircle, ExternalLink, Globe, Lock, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useContentVideos } from "@/hooks/useContent";
import { extractYouTubeId, formatTimestamp } from "@/lib/contentUtils";
import { Header } from "@/components/layout/Header";

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
    <div className="flex flex-col h-full">
      <Header title="Content" showFlowIcon={false} showAddButton={false} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="container max-w-5xl space-y-8 px-4 py-6 sm:px-6 md:space-y-10 md:py-10">


      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
        <h1 className="text-3xl font-light tracking-tight md:text-4xl">Discover the stories inside your videos.</h1>
        <p className="text-muted-foreground max-w-2xl">
          Paste a YouTube URL to ingest, analyze and semantically search any video your team uses.
        </p>
      </header>

      <Card className="space-y-4 p-4 sm:p-6">
        <div className="text-sm font-medium">Ingest a video</div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); if (url.trim()) ingest.mutate(url.trim()); }}
        >
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-11"
          />
          <Button type="submit" disabled={ingest.isPending || !url.trim()} className="h-11 px-6 sm:w-auto">
            {ingest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ingest"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4 p-4 sm:p-6">
        <div className="text-sm font-medium">Search your library</div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
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
          <Button type="submit" disabled={!query.trim()} className="h-11 px-6 sm:w-auto">Search</Button>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <Link to={`/content/videos/${v.id}`} key={v.id}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  {v.thumbnail_url && (
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      {v.is_featured && (
                        <div
                          className="absolute top-2 left-2 h-7 px-2 rounded-full bg-amber-500 text-white flex items-center gap-1 text-[11px] font-semibold backdrop-blur-sm shadow"
                          title="Featured on public library"
                        >
                          <Star className="h-3 w-3 fill-current" /> Featured
                        </div>
                      )}
                      <div
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm"
                        title={v.consent_level === "public_search" ? "Public" : "Internal only"}
                      >
                        {v.consent_level === "public_search"
                          ? <Globe className="h-3.5 w-3.5" />
                          : <Lock className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  )}

                  <div className="p-4 space-y-2">
                    <div className="font-medium line-clamp-2">{v.title ?? "Untitled"}</div>
                    {v.short_description ? (
                      <div className="text-xs text-muted-foreground line-clamp-2 italic">{v.short_description}</div>
                    ) : (
                      <div className="text-xs text-muted-foreground line-clamp-1">{v.channel_name}</div>
                    )}
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
      </div>
    </div>
  );

}

