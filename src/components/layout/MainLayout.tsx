import React from "react";
import { Sidebar } from "./Sidebar";
import { Outlet } from "react-router-dom";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { MobileSidebarProvider } from "@/contexts/MobileSidebarContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const MainLayout = () => {
  useDocumentTitle();
  return (
    <MobileSidebarProvider>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden">
        <ImpersonationBanner />
        <DemoModeBanner />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="mobile-navigation-content flex-1 flex flex-col h-full overflow-hidden min-w-0 max-w-full">
            <Outlet />
          </div>
        </div>
      </div>
    </MobileSidebarProvider>
  );
};
