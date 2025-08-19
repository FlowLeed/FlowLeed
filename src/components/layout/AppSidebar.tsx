import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  Heart, 
  Settings, 
  DollarSign,
  User
} from "lucide-react";

const AppSidebar = () => {
  const location = useLocation();

  const pagesItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
    },
    {
      title: "Analytics",
      icon: BarChart3,
      path: "/analytics",
      badge: "Beta",
    },
  ];

  const flowsItems = [
    {
      title: "Host Team Launch",
      path: "/pipelines/host-team",
    },
    {
      title: "Prayer",
      path: "/pipelines/prayer",
    },
    {
      title: "Operations",
      path: "/pipelines/operations",
    },
    {
      title: "Pastoral Care",
      path: "/pipelines/pastoral-care",
    },
    {
      title: "Giving Hub",
      path: "/pipelines/giving-hub",
    },
  ];

  const settingsItems = [
    {
      title: "My Profile",
      icon: User,
      path: "/profile",
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-semibold text-gray-900">Flowlead</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Pages Section */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pages</h3>
          </div>
          <div className="space-y-1">
            {pagesItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Flows Section */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Flows</h3>
          </div>
          <div className="space-y-1">
            {flowsItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Settings Section */}
        <div className="px-4 py-4 mt-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Settings</h3>
          </div>
          <div className="space-y-1">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppSidebar;