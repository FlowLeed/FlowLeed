
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { FlowProvider } from "./contexts/FlowContext";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import { SuperAdminProtectedRoute } from "./components/admin/SuperAdminProtectedRoute";
import { SuperAdminLayout } from "./components/admin/SuperAdminLayout";
import { ImpersonationEscapeHandler } from "./components/ImpersonationEscapeHandler";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import FlowPage from "./pages/FlowPage";
import FlowDocumentationPage from "./pages/FlowDocumentationPage";
import UserProfilePage from "./pages/UserProfilePage";
import ProfilePage from "./pages/ProfilePage";
import TeamPage from "./pages/TeamPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import AuthPage from "./pages/AuthPage";
import AuthVerifyPage from "./pages/AuthVerifyPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import InvitePage from "./pages/InvitePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ContactsPage from "./pages/ContactsPage";
import MessagesPage from "./pages/MessagesPage";
import CallsPage from "./pages/CallsPage";
import CalendarPage from "./pages/CalendarPage";
import TasksPage from "./pages/TasksPage";
import SuperAdminAuthPage from "./pages/admin/SuperAdminAuthPage";
import OrganizationsListPage from "./pages/admin/OrganizationsListPage";
import OrganizationDetailPage from "./pages/admin/OrganizationDetailPage";
import OnboardingFlowsPage from "./pages/admin/OnboardingFlowsPage";
import OngoingSupportFlowsPage from "./pages/admin/OngoingSupportFlowsPage";
import CommunicationsPage from "./pages/admin/CommunicationsPage";
import SuperAdminProfilePage from "./pages/admin/SuperAdminProfilePage";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ImpersonationEscapeHandler />
          <FlowProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/verify" element={<AuthVerifyPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              
              {/* Regular app routes */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/flows/:flowId" element={<FlowPage />} />
              <Route path="/flows/:flowId/documentation" element={<FlowDocumentationPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/contacts/:contactId" element={<UserProfilePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/calls" element={<CallsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              </Route>

              {/* FL-Admin super admin routes */}
              <Route path="/fl-admin/login" element={<SuperAdminAuthPage />} />
              <Route element={<SuperAdminProtectedRoute />}>
              <Route path="/fl-admin" element={<SuperAdminLayout />}>
                <Route index element={<OrganizationsListPage />} />
                <Route path="organizations/:id" element={<OrganizationDetailPage />} />
                <Route path="flows/onboarding" element={<OnboardingFlowsPage />} />
                <Route path="flows/ongoing-support" element={<OngoingSupportFlowsPage />} />
                <Route path="communications" element={<CommunicationsPage />} />
                <Route path="profile" element={<SuperAdminProfilePage />} />
              </Route>
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
