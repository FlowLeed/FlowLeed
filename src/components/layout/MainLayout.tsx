import React from "react";
import { Sidebar } from "./Sidebar";
import { Outlet } from "react-router-dom";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { MobileSidebarProvider } from "@/contexts/MobileSidebarContext";

export const MainLayout = () => {
  return (
    <MobileSidebarProvider>
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <ImpersonationBanner />
        <DemoModeBanner />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 max-w-full">
            <Outlet />
          </div>
        </div>
      </div>
    </MobileSidebarProvider>
  );
};
