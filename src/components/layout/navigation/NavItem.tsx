import { Link, useLocation } from "react-router-dom";
import type { NavItemConfig } from "@/types/navigation";

interface NavItemProps {
  item: NavItemConfig;
}

export const NavItem = ({ item }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === item.path;

  const content = (
    <div
      className={`flex w-full items-center gap-3 px-4 py-2 rounded-full text-sm font-medium transition-colors min-w-0 ${
        item.disabled
          ? "text-sidebar-foreground/30 cursor-not-allowed"
          : isActive
          ? "bg-purple-500 text-white"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 cursor-pointer"
      }`}
    >
      <item.icon
        className={`h-5 w-5 flex-shrink-0 ${
          item.disabled
            ? "text-sidebar-foreground/30"
            : isActive
            ? "text-white"
            : "text-purple-500"
        }`}
      />
      <span className="font-extralight truncate whitespace-nowrap min-w-0">
        {item.title}
      </span>
      {item.badge != null && item.badge > 0 && (
        <span
          className={`ml-auto text-xs rounded-full px-2 py-0.5 ${
            isActive ? "bg-white text-purple-500" : "bg-purple-500 text-white"
          }`}
        >
          {item.badge}
        </span>
      )}
      {item.disabled && (
        <span className="ml-auto text-xs text-sidebar-foreground/30">Soon</span>
      )}
    </div>
  );

  if (item.disabled) {
    return <div className="cursor-not-allowed">{content}</div>;
  }

  return <Link to={item.path}>{content}</Link>;
};
