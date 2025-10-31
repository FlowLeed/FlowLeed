import { useState, useEffect } from "react";

interface UseSlashCommandProps {
  content: string;
  onTrigger: () => void;
}

export const useSlashCommand = ({ content, onTrigger }: UseSlashCommandProps) => {
  const [isSlashCommandActive, setIsSlashCommandActive] = useState(false);

  useEffect(() => {
    // Check if content starts with "/" or is just "/"
    if (content === '/' || content.startsWith('/')) {
      setIsSlashCommandActive(true);
      onTrigger();
    } else {
      setIsSlashCommandActive(false);
    }
  }, [content, onTrigger]);

  const getSearchQuery = () => {
    if (content.startsWith('/')) {
      return content.slice(1);
    }
    return '';
  };

  return {
    isSlashCommandActive,
    searchQuery: getSearchQuery(),
    closeSlashCommand: () => setIsSlashCommandActive(false),
  };
};
