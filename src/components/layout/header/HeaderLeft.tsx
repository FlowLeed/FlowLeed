import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HeaderLeftProps } from "@/types/header";

export const HeaderLeft = ({ 
  title, 
  description, 
  icon: Icon, 
  onBackClick 
}: HeaderLeftProps) => {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button 
        onClick={handleBack}
        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5 text-muted-foreground" />
      </button>
      
      {Icon && (
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      )}
      
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
};
