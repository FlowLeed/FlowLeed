import { SVGProps, useId } from "react";

export const AiSparkleIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => {
  const id = useId();
  const gradId = `ai-sparkle-grad-${id}`;
  const glowId = `ai-sparkle-glow-${id}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e879f9" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#a855f7" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft glow halo */}
      <circle cx="13" cy="11" r="9" fill={`url(#${glowId})`} />

      {/* Big 4-point sparkle - filled with gradient */}
      <path
        d="M13 3c.5 3.2 1.8 4.5 5 5-3.2.5-4.5 1.8-5 5-.5-3.2-1.8-4.5-5-5 3.2-.5 4.5-1.8 5-5Z"
        fill={`url(#${gradId})`}
      />
      {/* Small sparkle top-right */}
      <path
        d="M19.5 2c.2 1.3.7 1.8 2 2-1.3.2-1.8.7-2 2-.2-1.3-.7-1.8-2-2 1.3-.2 1.8-.7 2-2Z"
        fill={`url(#${gradId})`}
      />
      {/* Small sparkle bottom-left */}
      <path
        d="M5 14c.2 1.5.8 2.1 2.3 2.3-1.5.2-2.1.8-2.3 2.3-.2-1.5-.8-2.1-2.3-2.3 1.5-.2 2.1-.8 2.3-2.3Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
};

export default AiSparkleIcon;
