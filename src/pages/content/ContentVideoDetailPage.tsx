import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Lock, Globe, ArrowLeft, Pencil, Check, X, Trash2, Upload, ImageIcon } from "lucide-react";
import { resolveThumb, handleYoutubeThumbError } from "@/lib/youtubeThumbnail";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/layout/Header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

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
  const navigate = useNavigate();
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");



  const retryIngest = useMutation({
    mutationFn: async () => {
      if (!video) throw new Error("no video");
      const { error } = await supabase.functions.invoke("content-ingest", {
        body: { youtubeUrl: video.url, organizationId: video.organization_id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Retrying transcript…" });
      qc.invalidateQueries({ queryKey: ["content-video", id] });
    },
    onError: (e: any) => toast({ title: "Retry failed", description: e?.message ?? String(e), variant: "destructive" }),
  });

  const deleteVideo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_videos" as any).delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Video deleted" });
      qc.invalidateQueries({ queryKey: ["content-videos"] });
      navigate(-1);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message ?? String(e), variant: "destructive" }),
  });

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
      qc.invalidateQueries({ queryKey: ["content-videos"] });
      toast({ title: "Visibility updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? String(e), variant: "destructive" }),
  });
  const saveTitle = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase
        .from("content_videos" as any)
        .update({ title })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-video", id] });
      qc.invalidateQueries({ queryKey: ["content-videos"] });
      setEditingTitle(false);
      toast({ title: "Title updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? String(e), variant: "destructive" }),
  });

  const saveDescription = useMutation({
    mutationFn: async (short_description: string) => {
      const { error } = await supabase
        .from("content_videos" as any)
        .update({ short_description: short_description.trim() || null })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-video", id] });
      qc.invalidateQueries({ queryKey: ["content-videos"] });
      setEditingDescription(false);
      toast({ title: "Description updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? String(e), variant: "destructive" }),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const uploadThumbnail = async (file: File) => {
    if (!video) return;
    try {
      setUploadingThumb(true);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${video.organization_id}/${video.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("content-thumbnails")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("content-thumbnails").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("content_videos" as any)
        .update({ thumbnail_url: pub.publicUrl })
        .eq("id", video.id);
      if (updErr) throw updErr;
      qc.invalidateQueries({ queryKey: ["content-video", video.id] });
      qc.invalidateQueries({ queryKey: ["content-videos"] });
      toast({ title: "Thumbnail updated" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setUploadingThumb(false);
    }
  };

  const clearThumbnail = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("content_videos" as any)
        .update({ thumbnail_url: null })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-video", id] });
      qc.invalidateQueries({ queryKey: ["content-videos"] });
      toast({ title: "Thumbnail cleared — using YouTube fallback" });
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
    <div className="flex flex-col h-full">
      <Header
        title={video.title || "Video"}
        showFlowIcon={false}
        showAddButton={false}
        showBackButton
        onBackClick={() => navigate(-1)}
        rightContent={
          isOrgAdmin ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this video?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the video, transcript, analysis, and chat history. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteVideo.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl py-10 px-6 space-y-6">

      <header className="space-y-2">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && titleDraft.trim()) saveTitle.mutate(titleDraft.trim());
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="text-2xl h-11 font-light"
            />
            <Button size="icon" variant="ghost" disabled={saveTitle.isPending || !titleDraft.trim()} onClick={() => saveTitle.mutate(titleDraft.trim())}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditingTitle(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="text-2xl font-light">{video.title}</h1>
            {isOrgAdmin && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => { setTitleDraft(video.title ?? ""); setEditingTitle(true); }}
                aria-label="Edit title"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Public short description (story highlight) */}
        {editingDescription ? (
          <div className="space-y-2">
            <Textarea
              autoFocus
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value.slice(0, 240))}
              placeholder="One emotional sentence that captures the story (shown on the public library)"
              rows={2}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">
                {descriptionDraft.length}/240 · Shown on public library cards
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditingDescription(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => saveDescription.mutate(descriptionDraft)} disabled={saveDescription.isPending}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="group flex items-start gap-2">
            <p className={`text-sm flex-1 leading-relaxed ${video.short_description ? "text-foreground/80 italic" : "text-muted-foreground"}`}>
              {video.short_description || (isOrgAdmin ? "Add a one-sentence story highlight…" : "")}
            </p>
            {isOrgAdmin && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => { setDescriptionDraft(video.short_description ?? ""); setEditingDescription(true); }}
                aria-label="Edit description"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}


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
            <>
              <Badge variant="destructive" className="text-xs">Failed: {video.error_message}</Badge>
              {isOrgAdmin && (
                <Button size="sm" variant="outline" onClick={() => retryIngest.mutate()} disabled={retryIngest.isPending}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${retryIngest.isPending ? "animate-spin" : ""}`} /> Retry
                </Button>
              )}
            </>
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

      {isOrgAdmin && (
        <Card className="p-4 flex items-center gap-4">
          <div className="w-28 aspect-video rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
            {resolveThumb(video.thumbnail_url, video.youtube_id) ? (
              <img
                src={resolveThumb(video.thumbnail_url, video.youtube_id)!}
                onError={handleYoutubeThumbError}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Thumbnail</div>
            <div className="text-xs text-muted-foreground">
              {video.thumbnail_url
                ? "Custom thumbnail uploaded. Shown on the public library."
                : "Using YouTube's auto-poster. Upload a custom image to override."}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadThumbnail(f);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingThumb}
          >
            {uploadingThumb ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {video.thumbnail_url ? "Replace" : "Upload"}
          </Button>
          {video.thumbnail_url && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clearThumbnail.mutate()}
              disabled={clearThumbnail.isPending}
            >
              Clear
            </Button>
          )}
        </Card>
      )}



      <Tabs defaultValue="overview">
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>
          {isOrgAdmin && (
            <div className="flex items-center gap-2">
              <Label htmlFor="visibility-toggle" className="text-sm">Public</Label>
              <Switch
                id="visibility-toggle"
                checked={video.consent_level === "public_search"}
                disabled={setConsent.isPending}
                onCheckedChange={(v) => setConsent.mutate(v ? "public_search" : "internal_use")}
              />
            </div>
          )}
        </div>

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
      </Tabs>
        </div>
      </div>
    </div>
  );
}

