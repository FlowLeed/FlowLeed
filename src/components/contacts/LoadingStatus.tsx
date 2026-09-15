import { useEffect, useState } from "react";

const STATUS_MESSAGES = [
  "Finding the people who match...",
  "Checking their journeys...",
  "Looking at recent activity...",
  "Connecting the right signals...",
  "Making sure no one gets missed...",
  "Building your list...",
  "Almost there...",
];

/**
 * Rotating, human-centered status lines shown while the people list loads.
 * Cycles every ~1.8s with a soft fade so it feels like active work.
 */
export const LoadingStatus = ({ label }: { label?: string }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const message = label ?? STATUS_MESSAGES[index];

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary/70 animate-pulse" style={{ animationDelay: "0ms" }} />
        <span className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: "200ms" }} />
        <span className="h-2 w-2 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: "400ms" }} />
      </div>
      <p key={message} className="animate-fade-in text-sm font-light text-muted-foreground tracking-wide">
        {message}
      </p>
    </div>
  );
};
