
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-crm-background">
      <div className="text-center bg-white p-10 rounded-lg shadow-sm border border-crm-border max-w-md">
        <h1 className="text-5xl font-bold text-crm-primary mb-4">404</h1>
        <p className="text-xl text-gray-700 mb-8">Oops! Page not found</p>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Button asChild className="flex items-center gap-2">
          <a href="/">
            <ArrowLeft className="h-4 w-4" />
            Return to FlowLeed AI
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
