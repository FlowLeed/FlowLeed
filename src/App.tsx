
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useGoogleAnalyticsPageView } from "./hooks/useGoogleAnalyticsPageView";
import { MainLayout } from "./components/layout/MainLayout";
import { FlowProvider } from "./contexts/FlowContext";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import { SuperAdminProtectedRoute } from "./components/admin/SuperAdminProtectedRoute";
import { SuperAdminLayout } from "./components/admin/SuperAdminLayout";
import { ImpersonationEscapeHandler } from "./components/ImpersonationEscapeHandler";
import { FeatureGate } from "./components/FeatureGate";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const FlowPage = lazy(() => import("./pages/FlowPage"));
const FlowDocumentationPage = lazy(() => import("./pages/FlowDocumentationPage"));
const FlowAnalyticsPage = lazy(() => import("./pages/FlowAnalyticsPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const GroupDetailPage = lazy(() => import("./pages/GroupDetailPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const IntegrationAdvancedSettingsPage = lazy(() => import("./pages/IntegrationAdvancedSettingsPage"));
const ChurchOnlineAdvancedPage = lazy(() => import("./pages/ChurchOnlineAdvancedPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const AuthVerifyPage = lazy(() => import("./pages/AuthVerifyPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ContactsPage = lazy(() => import("./pages/ContactsPage"));
const SignalsPage = lazy(() => import("./pages/SignalsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const CallsPage = lazy(() => import("./pages/CallsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const SuperAdminAuthPage = lazy(() => import("./pages/admin/SuperAdminAuthPage"));
const OrganizationsListPage = lazy(() => import("./pages/admin/OrganizationsListPage"));
const OrganizationDetailPage = lazy(() => import("./pages/admin/OrganizationDetailPage"));
const OnboardingFlowsPage = lazy(() => import("./pages/admin/OnboardingFlowsPage"));
const OngoingSupportFlowsPage = lazy(() => import("./pages/admin/OngoingSupportFlowsPage"));
const CommunicationsPage = lazy(() => import("./pages/admin/CommunicationsPage"));
const SuperAdminProfilePage = lazy(() => import("./pages/admin/SuperAdminProfilePage"));
const GroupPublicSignupPage = lazy(() => import("./pages/GroupPublicSignupPage"));
const GroupDirectoryPage = lazy(() => import("./pages/GroupDirectoryPage"));
const PcoCallbackPage = lazy(() => import("./pages/PcoCallbackPage"));
const DevMobilePreviewPage = lazy(() => import("./pages/DevMobilePreviewPage"));
const ContentDashboardPage = lazy(() => import("./pages/content/ContentDashboardPage"));
const ContentSearchPage = lazy(() => import("./pages/content/ContentSearchPage"));
const ContentVideoDetailPage = lazy(() => import("./pages/content/ContentVideoDetailPage"));
const ContentLibraryPage = lazy(() => import("./pages/content/ContentLibraryPage"));
const ContentChatPage = lazy(() => import("./pages/content/ContentChatPage"));
const PublicContentPage = lazy(() => import("./pages/content/PublicContentPage"));
const PublicContentVideoPage = lazy(() => import("./pages/content/PublicContentVideoPage"));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <ImpersonationEscapeHandler />
        <FlowProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/verify" element={<AuthVerifyPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/groups/directory" element={<GroupDirectoryPage />} />
              <Route path="/groups/join/:token" element={<GroupPublicSignupPage />} />
              <Route path="/pco/callback" element={<PcoCallbackPage />} />
              <Route path="/pco/callback" element={<PcoCallbackPage />} />
              <Route path="/dev/mobile-preview" element={<DevMobilePreviewPage />} />
              <Route path="/org/:slug/content" element={<PublicContentPage />} />
              <Route path="/org/:slug/content/videos/:id" element={<PublicContentVideoPage />} />
              
              {/* Regular app routes */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/flows/:flowId" element={<FlowPage />} />
              <Route path="/flows/:flowId/documentation" element={<FlowDocumentationPage />} />
              <Route path="/flows/:flowId/analytics" element={<FlowAnalyticsPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/signals" element={<FeatureGate feature="signals"><SignalsPage /></FeatureGate>} />
              <Route path="/contacts/:contactId" element={<UserProfilePage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/groups/:groupId" element={<GroupDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/integrations/:integrationName/advanced" element={<IntegrationAdvancedSettingsPage />} />
              <Route path="/integrations/church-online/advanced" element={<ChurchOnlineAdvancedPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/messages" element={<FeatureGate feature="texting"><MessagesPage /></FeatureGate>} />
              <Route path="/calls" element={<FeatureGate feature="calling"><CallsPage /></FeatureGate>} />
              <Route path="/content" element={<FeatureGate feature="content"><ContentDashboardPage /></FeatureGate>} />
              <Route path="/content/search" element={<FeatureGate feature="content"><ContentSearchPage /></FeatureGate>} />
              <Route path="/content/library" element={<FeatureGate feature="content"><ContentLibraryPage /></FeatureGate>} />
              <Route path="/content/chat" element={<FeatureGate feature="content"><ContentChatPage /></FeatureGate>} />
              <Route path="/content/videos/:id" element={<FeatureGate feature="content"><ContentVideoDetailPage /></FeatureGate>} />
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
          </Suspense>
        </FlowProvider>
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
