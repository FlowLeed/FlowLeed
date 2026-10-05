import React from "react";

/**
 * FlowLeed AI brand icon — a purple rounded tile with a white
 * sparkle mark (4-point star, small plus, small dot).
 * Renders at any size via className (defaults to h-5 w-5).
 */
const AiBrandIcon = ({ className = "h-5 w-5", ...props }: React.SVGProps<SVGSVGElement> & { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    focusable="false"
    {...props}
  >
    <rect width="24" height="24" rx="6" fill="#5962D9" />
    {/* Big 4-point sparkle */}
    <path
      fill="#FFFFFF"
      d="M12 5.2c.5 3.4 1.9 4.8 5.3 5.3-3.4.5-4.8 1.9-5.3 5.3-.5-3.4-1.9-4.8-5.3-5.3 3.4-.5 4.8-1.9 5.3-5.3Z"
    />
    {/* Small plus top-right */}
    <path
      fill="#FFFFFF"
      d="M17.6 5.4h1.1v1.1h1.1v1.1h-1.1v1.1h-1.1V7.6h-1.1V6.5h1.1V5.4Z"
    />
    {/* Small dot bottom-left */}
    <circle cx="6.6" cy="16.4" r="1.05" fill="#FFFFFF" />
  </svg>
);

export default AiBrandIcon;
