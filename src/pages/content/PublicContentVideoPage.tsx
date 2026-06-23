import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Film, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatTimestamp, youtubeEmbedUrl } from "@/lib/contentUtils";

interface Chunk { id: string; chunk_index: number; text: string; start_seconds: number; end_seconds: number; }
interface Analysis {
  summary: string | null;
  themes: string[] | null;
  story_patterns: Array<{ name: string; description: string }> | null;
  key_quotes: Array<{ text: string; start_seconds: number; impact_score: number }> | null;
  impact_score: number | null;
}
interface Video {
  id: string; youtube_id: string; title: string | null; channel_name: string | null;
  thumbnail_url: string | null; duration_seconds: number | null; description: string | null;
  published_at: string | null;
}

export default function PublicContentVideoPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const initialT = Number(params.get("t") ?? 0) || 0;
  const [currentSeek, setCurrentSeek] = useState(initialT);

  useEffect(() => {
    const load = async () => {
      if (!slug || !id) return;
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_content_video" as any, {
        p_slug: slug, p_video_id: id,
      });
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      const d = data as any;
      setVideo(d.video);
      setAnalysis(d.analysis);
      setChunks(d.chunks ?? []);
      setLoading(false);
    };
    load();
  }, [slug, id]);

  const embedSrc = useMemo(() => video ? youtubeEmbedUrl(video.youtube_id, currentSeek) : "", [video, currentSeek]);

  const jumpTo = (sec: number) => {
    setCurrentSeek(sec);
    const next = new URLSearchParams(params);
    next.set("t", String(Math.floor(sec)));
    setParams(next, { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !video) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="p-10 text-center max-w-md space-y-3">
          <Film className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-light">Video not available</h1>
          <p className="text-sm text-muted-foreground">This video isn't shared publicly.</p>
          <Button asChild variant="outline" size="sm">
            <Link to={`/org/${slug}/content`}><ArrowLeft className="h-4 w-4 mr-1" /> Back to library</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="container max-w-6xl py-8 px-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/org/${slug}/content`}><ArrowLeft className="h-4 w-4 mr-1" /> Library</Link>
          </Button>
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Film className="h-3.5 w-3.5" /> Public
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
              <iframe
                ref={iframeRef}
                key={embedSrc}
                src={embedSrc}
                title={video.title ?? "Video"}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-light">{video.title}</h1>
              <div className="text-sm text-muted-foreground">{video.channel_name}</div>
            </div>

            {analysis?.summary && (
              <Card className="p-5 space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary</div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.summary}</p>
                {analysis.themes && analysis.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {analysis.themes.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {analysis?.key_quotes && analysis.key_quotes.length > 0 && (
              <Card className="p-5 space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Key moments</div>
                <div className="space-y-2">
                  {analysis.key_quotes.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => jumpTo(q.start_seconds)}
                      className="w-full text-left p-3 rounded-md hover:bg-muted/50 transition-colors flex gap-3 items-start"
                    >
                      <Badge variant="outline" className="text-xs shrink-0">{formatTimestamp(q.start_seconds)}</Badge>
                      <p className="text-sm flex-1">{q.text}</p>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="p-0 overflow-hidden h-[600px] flex flex-col">
              <div className="px-4 py-3 border-b text-xs uppercase tracking-wide text-muted-foreground">
                Transcript
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {chunks.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">No transcript available.</div>
                  )}
                  {chunks.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => jumpTo(c.start_seconds)}
                      className="w-full text-left p-3 rounded-md hover:bg-muted/50 transition-colors block"
                    >
                      <div className="text-[10px] text-muted-foreground font-mono mb-1">
                        {formatTimestamp(c.start_seconds)}
                      </div>
                      <p className="text-sm leading-relaxed">{c.text}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
