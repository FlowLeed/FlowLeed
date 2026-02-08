import { cn } from "@/lib/utils";

interface GroupAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const GroupAvatar = ({ name, imageUrl, size = "md", className }: GroupAvatarProps) => {
  const initials = getInitials(name);
  
  if (imageUrl) {
    return (
      <div className={cn("rounded-lg overflow-hidden flex-shrink-0", sizeClasses[size], className)}>
        <img 
          src={imageUrl} 
          alt={name} 
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        "rounded-lg bg-primary/10 flex items-center justify-center font-semibold text-primary flex-shrink-0",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
};
