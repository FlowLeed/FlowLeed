
import React from "react";
import AppSidebar from "./AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import PipelineTabs from "../crm/PipelineTabs";

export const MainLayout = () => {
  const location = useLocation();
  const isPipelinePage = location.pathname.startsWith('/pipelines/');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {isPipelinePage && <PipelineTabs />}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
