import { Outlet } from 'react-router-dom';
import { SuperAdminSidebar } from './SuperAdminSidebar';

export const SuperAdminLayout = () => {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};
