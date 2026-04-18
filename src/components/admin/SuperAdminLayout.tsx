import { Outlet } from 'react-router-dom';
import { SuperAdminSidebar } from './SuperAdminSidebar';
import { MobileSidebarProvider } from '@/contexts/MobileSidebarContext';

export const SuperAdminLayout = () => {
  return (
    <MobileSidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <SuperAdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Outlet />
        </div>
      </div>
    </MobileSidebarProvider>
  );
};
