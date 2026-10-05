import { SVGProps } from "react";

export const AiSparkleIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Big 4-point sparkle */}
    <path d="M13 3.5c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4Z" />
    {/* Small sparkle top-right */}
    <path d="M19.5 2.5c.15 1 .55 1.4 1.5 1.5-.95.15-1.35.55-1.5 1.5-.15-.95-.55-1.35-1.5-1.5.95-.1 1.35-.5 1.5-1.5Z" />
    {/* Small sparkle bottom-left */}
    <path d="M5 14.5c.2 1.3.7 1.8 2 2-1.3.2-1.8.7-2 2-.2-1.3-.7-1.8-2-2 1.3-.2 1.8-.7 2-2Z" />
  </svg>
);

export default AiSparkleIcon;
