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
  position = 'sticky',
}: BaseHeaderProps) => {
  const positionClasses = position === 'fixed' ? 'fixed inset-x-0 top-0' : 'sticky top-0';
  return (
    <div className={`${positionClasses} z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`}>
      <div className="flex items-center justify-between h-16 px-6 w-full">
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
