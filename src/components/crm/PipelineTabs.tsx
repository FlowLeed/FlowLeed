import React from "react";
import { Link, useLocation } from "react-router-dom";

const PipelineTabs = () => {
  const location = useLocation();

  const tabs = [
    { name: "Host Team", path: "/pipelines/host-team" },
    { name: "Prayer", path: "/pipelines/prayer" },
    { name: "Operations", path: "/pipelines/operations" },
    { name: "Pastoral Care", path: "/pipelines/pastoral-care" },
    { name: "Giving Hub", path: "/pipelines/giving-hub" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-0">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive(tab.path)
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default PipelineTabs;