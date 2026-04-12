import React from "react";
import { Users, BarChart3, UserCog, Heart } from "lucide-react";

export type Category = "people" | "numbers" | "team" | "care";

interface CategoryChipsProps {
  selected: Category | null;
  onSelect: (category: Category | null) => void;
}

const categories: { id: Category; label: string; icon: React.ElementType; color: string }[] = [
  { id: "people", label: "People", icon: Users, color: "bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20" },
  { id: "numbers", label: "Numbers", icon: BarChart3, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20" },
  { id: "team", label: "Team", icon: UserCog, color: "bg-purple-500/10 text-purple-600 border-purple-200 hover:bg-purple-500/20" },
  { id: "care", label: "Care", icon: Heart, color: "bg-rose-500/10 text-rose-600 border-rose-200 hover:bg-rose-500/20" },
];

export const CategoryChips: React.FC<CategoryChipsProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {categories.map(({ id, label, icon: Icon, color }) => {
        const isActive = selected === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(isActive ? null : id)}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition-all
              ${isActive ? color + " ring-2 ring-offset-1 ring-current/20" : color}
            `}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
};
