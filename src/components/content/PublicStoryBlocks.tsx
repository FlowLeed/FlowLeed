import { YouTubePlayer } from "@/components/content/YouTubePlayer";
import type { ReactNode } from "react";
import type { StoryBlock } from "@/lib/storyTypes";
import { cn } from "@/lib/utils";

export function PublicStoryBlocks({ blocks, renderNextStep }: { blocks: StoryBlock[]; renderNextStep?: (block: StoryBlock) => ReactNode }) {
  return (
    <div className="space-y-8 md:space-y-12">
      {blocks.map((block) => {
        if (block.block_type === "next_step") return renderNextStep ? <div key={block.id} className="-mx-4 md:-mx-6">{renderNextStep(block)}</div> : null;
        if (block.block_type === "heading") return <h2 key={block.id} className="pt-4 text-2xl font-semibold leading-tight text-foreground md:text-3xl">{block.heading}</h2>;
        if (block.block_type === "paragraph") return <p key={block.id} className="whitespace-pre-line text-base leading-8 text-foreground/85 md:text-lg md:leading-9">{block.body}</p>;
        if (block.block_type === "quote") return (
          <figure key={block.id} className="border-l-2 border-primary bg-story-paper px-6 py-7 md:px-9 md:py-10">
            <blockquote className="text-xl font-medium leading-8 text-foreground md:text-2xl md:leading-10">“{block.body}”</blockquote>
            {block.quote_attribution && <figcaption className="mt-4 text-sm text-muted-foreground">— {block.quote_attribution}</figcaption>}
          </figure>
        );
        if (block.block_type === "image" && block.media_url) return (
          <figure key={block.id} className="space-y-3">
            <img src={block.media_url} alt={block.media_alt ?? ""} className="max-h-[720px] w-full object-cover" />
            {block.caption && <figcaption className="text-xs leading-5 text-muted-foreground">{block.caption}</figcaption>}
          </figure>
        );
        if (block.block_type === "gallery" && block.gallery_items.length) return (
          <div key={block.id} className="grid gap-3 sm:grid-cols-2">
            {block.gallery_items.map((item, index) => <img key={`${item.url}-${index}`} src={item.url} alt={item.alt ?? ""} className={cn("h-full min-h-[240px] w-full object-cover", index === 2 && "sm:col-span-2 sm:max-h-[480px]")} />)}
          </div>
        );
        if (block.block_type === "video" && block.video_id) return (
          <div key={block.id} className={cn("relative mx-auto overflow-hidden bg-story-media", block.video_orientation === "vertical" ? "aspect-[9/16] w-full max-w-[420px]" : "aspect-video w-full")}>
            <YouTubePlayer youtubeId={block.video_id} title={block.caption ?? "Story clip"} className="absolute inset-0" />
          </div>
        );
        return null;
      })}
    </div>
  );
}
