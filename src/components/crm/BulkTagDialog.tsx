import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useOrgTags } from "@/hooks/useOrgTags";

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'remove';
  onConfirm: (tags: string[]) => void;
}

export const BulkTagDialog: React.FC<BulkTagDialogProps> = ({
  open,
  onOpenChange,
  mode,
  onConfirm,
}) => {
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const { organization } = useProfile();
  const { tagStats } = useOrgTags(organization?.id);

  const suggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    return tagStats
      .filter(({ tag }) => !tags.includes(tag) && (!q || tag.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [tagStats, tags, inputValue]);

  const addTag = (value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue && !tags.includes(trimmedValue)) {
      setTags([...tags, trimmedValue]);
      setInputValue("");
    }
  };

  const handleAddTag = () => addTag(inputValue);

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleConfirm = () => {
    if (tags.length > 0) {
      onConfirm(tags);
      setTags([]);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add Tags' : 'Remove Tags'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add' 
              ? 'Enter tags to add to all selected people'
              : 'Enter tags to remove from all selected people'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a tag and press Enter"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button onClick={handleAddTag} type="button">
              Add
            </Button>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:bg-background/50 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {mode === 'add' ? 'Existing tags in your organization' : 'Tags in use'}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map(({ tag, count }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="text-xs rounded-full border px-2.5 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {tag} <span className="opacity-60">({count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={tags.length === 0}>
            {mode === 'add' ? 'Add Tags' : 'Remove Tags'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
