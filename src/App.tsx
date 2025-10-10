
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { FlowProvider } from "./contexts/FlowContext";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import FlowPage from "./pages/FlowPage";
import UserProfilePage from "./pages/UserProfilePage";
import ProfilePage from "./pages/ProfilePage";
import TeamPage from "./pages/TeamPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import AuthPage from "./pages/AuthPage";
import InvitePage from "./pages/InvitePage";
import AnalyticsPage from "./pages/AnalyticsPage";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FlowProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/flows/:flowId" element={<FlowPage />} />
                <Route path="/contacts/:contactId" element={<UserProfilePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </FlowProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
