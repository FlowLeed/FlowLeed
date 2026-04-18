import React, { createContext, useContext, useState } from "react";

interface MobileSidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextValue | undefined>(undefined);

export const MobileSidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen, toggle: () => setOpen(!open) }}>
      {children}
    </MobileSidebarContext.Provider>
  );
};

export const useMobileSidebar = () => {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) {
    // Safe fallback when used outside provider
    return { open: false, setOpen: () => {}, toggle: () => {} };
  }
  return ctx;
};
