import { useState } from "react";
import { Bell, Search } from "lucide-react";
import { HeaderRightProps } from "@/types/header";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";

export const HeaderRight = ({ 
  showNotifications = true,
  showSearch = true,
  showUserMenu = true,
  customActions 
}: HeaderRightProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  useGlobalSearch({ onToggle: () => setIsSearchOpen(!isSearchOpen) });

  return (
    <>
      <div className="flex items-center gap-2">
        {customActions}
        
        {showNotifications && (
          <button 
            className="p-2 rounded-lg hover:bg-accent transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        
        {showSearch && (
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        
        {(showNotifications || showSearch) && showUserMenu && (
          <div className="border-l border-border h-6 mx-2" />
        )}
        
        {showUserMenu && <HeaderUserMenu />}
      </div>
      
      {isSearchOpen && (
        <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      )}
    </>
  );
};
