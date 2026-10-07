import React, { createContext, useContext, useState } from "react";

interface MobileSidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Set when the header hamburger opens the menu — Sidebar shows the full compact list. */
  openAll: () => void;
  showAll: boolean;
}

const MobileSidebarContext = createContext<MobileSidebarContextValue | undefined>(undefined);

export const MobileSidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  return (
    <MobileSidebarContext.Provider
      value={{
        open,
        setOpen: (v) => { setOpen(v); if (!v) setShowAll(false); },
        toggle: () => setOpen(!open),
        openAll: () => { setShowAll(true); setOpen(true); },
        showAll,
      }}
    >
      {children}
    </MobileSidebarContext.Provider>
  );
};

export const useMobileSidebar = () => {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) {
    // Safe fallback when used outside provider
    return { open: false, setOpen: () => {}, toggle: () => {}, openAll: () => {}, showAll: false };
  }
  return ctx;
};
