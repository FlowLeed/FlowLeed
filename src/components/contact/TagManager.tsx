import React, { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TagManagerProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
  placeholder?: string;
}

export const TagManager: React.FC<TagManagerProps> = ({
  tags,
  onTagsChange,
  suggestions = [],
  maxTags,
  placeholder = "Type to add tags...",
}) => {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize tag: lowercase, replace spaces with hyphens, remove special chars
  const normalizeTag = (tag: string): string => {
    return tag
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 30);
  };

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(
    (s) => 
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(s) &&
      s !== inputValue
  );

  const addTag = (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    
    if (maxTags && tags.length >= maxTags) {
      return;
    }

    if (!tags.includes(normalized)) {
      onTagsChange([...tags, normalized]);
    }
    
    setInputValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(e.target.value.length > 0);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      {/* Input with Add Button */}
      <div className="flex gap-2 relative">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(inputValue.length > 0)}
            placeholder={placeholder}
            className="pr-8"
          />
          
          {/* Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md z-50 max-h-48 overflow-y-auto">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <Button
          type="button"
          size="sm"
          onClick={() => inputValue.trim() && addTag(inputValue)}
          disabled={!inputValue.trim() || (maxTags !== undefined && tags.length >= maxTags)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Display Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pl-2.5 pr-1.5 py-1"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:bg-secondary-foreground/20 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Popular/Suggested Tags */}
      {!showSuggestions && suggestions.length > 0 && inputValue === "" && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Popular:</span>
          {suggestions.slice(0, 5).map((suggestion) => (
            !tags.includes(suggestion) && (
              <button
                key={suggestion}
                type="button"
                onClick={() => addTag(suggestion)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                disabled={maxTags !== undefined && tags.length >= maxTags}
              >
                {suggestion}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
};
