import React from "react";
import { Sidebar } from "./Sidebar";
import { Outlet } from "react-router-dom";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

export const MainLayout = () => {
  return (
    <div className="flex h-screen w-full flex-col">
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
