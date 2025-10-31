import { Block } from "@/types/resources";
import { HeadingBlock } from "./HeadingBlock";
import { ParagraphBlock } from "./ParagraphBlock";
import { DividerBlock } from "./DividerBlock";
import { ChecklistBlock } from "./ChecklistBlock";
import { ToggleBlock } from "./ToggleBlock";

interface ResourcesViewerProps {
  blocks: Block[];
}

export const ResourcesViewer = ({ blocks }: ResourcesViewerProps) => {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No documentation yet.</p>
        <p className="text-sm mt-1">Click Edit to start adding content.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {blocks.map((block) => (
        <div key={block.id} className="py-0.5">
          {block.type === 'heading' && (
            <HeadingBlock block={block} isEditing={false} />
          )}
          {block.type === 'paragraph' && (
            <ParagraphBlock block={block} isEditing={false} />
          )}
          {block.type === 'divider' && <DividerBlock />}
          {block.type === 'checklist' && (
            <ChecklistBlock block={block} isEditing={false} />
          )}
          {block.type === 'toggle' && (
            <ToggleBlock block={block} isEditing={false} />
          )}
          {block.type === 'bulletList' && (
            <ul className="list-disc list-inside space-y-1 text-base leading-relaxed">
              {block.content.split("\n").filter(item => item.trim()).map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}
          {block.type === 'numberedList' && (
            <ol className="list-decimal list-inside space-y-1 text-base leading-relaxed">
              {block.content.split("\n").filter(item => item.trim()).map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
};
