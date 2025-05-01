
import React from "react";
import { Link } from "react-router-dom";
import { Plus, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

interface HeaderProps {
  title: string;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showAddButton = true,
  onAddClick,
  addButtonLabel = "New Person"
}) => {
  return (
    <div className="flex items-center justify-between h-16 px-6 border-b border-crm-border">
      <div className="text-xl font-semibold">{title}</div>
      <div className="flex items-center gap-4">
        {showAddButton && (
          <Button onClick={onAddClick} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            {addButtonLabel}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-slate-100">
            <Bell className="h-5 w-5 text-slate-500" />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100">
            <Search className="h-5 w-5 text-slate-500" />
          </button>
          <div className="border-l border-gray-200 h-6 mx-2" />
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <div className="bg-crm-primary text-white rounded-full w-full h-full flex items-center justify-center">
                EB
              </div>
            </Avatar>
            <span className="text-sm font-medium">Erik Brown</span>
          </div>
        </div>
      </div>
    </div>
  );
};
