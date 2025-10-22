import { BaseHeaderProps } from "@/types/header";
import { HeaderLeft } from "./HeaderLeft";
import { HeaderCenter } from "./HeaderCenter";
import { HeaderRight } from "./HeaderRight";

export const BaseHeader = ({
  title,
  description,
  icon,
  onBackClick,
  centerContent,
  rightContent,
  customActions,
  showNotifications = true,
  showSearch = true,
  showUserMenu = true,
}: BaseHeaderProps) => {
  return (
    <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between h-16 px-6">
        <HeaderLeft
          title={title}
          description={description}
          icon={icon}
          onBackClick={onBackClick}
        />
        
        {centerContent && (
          <HeaderCenter>
            {centerContent}
          </HeaderCenter>
        )}
        
        {rightContent ? (
          rightContent
        ) : (
          <HeaderRight
            showNotifications={showNotifications}
            showSearch={showSearch}
            showUserMenu={showUserMenu}
            customActions={customActions}
          />
        )}
      </div>
    </div>
  );
};
