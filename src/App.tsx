
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "./lib/lazyWithRetry";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { useGoogleAnalyticsPageView } from "./hooks/useGoogleAnalyticsPageView";
import { MainLayout } from "./components/layout/MainLayout";
import { FlowProvider } from "./contexts/FlowContext";
import FlowsIndexRedirect from "./pages/FlowsIndexRedirect";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import { SuperAdminProtectedRoute } from "./components/admin/SuperAdminProtectedRoute";
import { SuperAdminLayout } from "./components/admin/SuperAdminLayout";
import { ImpersonationEscapeHandler } from "./components/ImpersonationEscapeHandler";
import { FeatureGate } from "./components/FeatureGate";
import { OrgContentRedirect, OrgContentVideoRedirect, OrgGroupsRedirect } from "./pages/public/OrgRedirect";

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
const GroupSettingsPage = lazy(() => import("./pages/settings/GroupSettingsPage"));
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
const CustomSignalsPage = lazy(() => import("./pages/signals/CustomSignalsPage"));
const SignalAgentPage = lazy(() => import("./pages/signals/SignalAgentPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const CallsPage = lazy(() => import("./pages/CallsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const PrayerHubPage = lazy(() => import("./pages/PrayerHubPage"));
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
const AuditSignupPage = lazy(() => import("./pages/audit/AuditSignupPage"));
const AuditConnectPage = lazy(() => import("./pages/audit/AuditConnectPage"));
const AuditGeneratingPage = lazy(() => import("./pages/audit/AuditGeneratingPage"));
const AuditReportPage = lazy(() => import("./pages/audit/AuditReportPage"));
const FormsListPage = lazy(() => import("./pages/forms/FormsListPage"));
const FormBuilderPage = lazy(() => import("./pages/forms/FormBuilderPage"));
const FormSubmissionsPage = lazy(() => import("./pages/forms/FormSubmissionsPage"));
const PublicFormPage = lazy(() => import("./pages/public/PublicFormPage"));
const PublicPrayerPage = lazy(() => import("./pages/public/PublicPrayerPage"));
const PublicFormRedirect = lazy(() => import("./pages/public/PublicFormRedirect"));



const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const GoogleAnalyticsTracker = () => {
  useGoogleAnalyticsPageView();
  return null;
};

const AuditOutlet = () => <Outlet />;

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <ImpersonationEscapeHandler />
        <FlowProvider>
          <Suspense fallback={<RouteFallback />}>
            <GoogleAnalyticsTracker />
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/verify" element={<AuthVerifyPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/groups/directory" element={<GroupDirectoryPage />} />
              <Route path="/groups/join/:token" element={<GroupPublicSignupPage />} />
              <Route path="/pco/callback" element={<PcoCallbackPage />} />
              <Route path="/dev/mobile-preview" element={<DevMobilePreviewPage />} />

              {/* Legacy public routes → redirect to new /:orgSlug/... URLs */}
              <Route path="/org/:slug/groups" element={<OrgGroupsRedirect />} />
              <Route path="/org/:slug/content" element={<OrgContentRedirect />} />
              <Route path="/org/:slug/content/videos/:id" element={<OrgContentVideoRedirect />} />
              <Route path="/f/:slug" element={<PublicFormRedirect />} />

              {/* Audit / lead-magnet funnel */}
              <Route path="/audit" element={<AuditSignupPage />} />
              <Route element={<ProtectedRoute><AuditOutlet /></ProtectedRoute>}>
                <Route path="/audit/connect" element={<AuditConnectPage />} />
                <Route path="/audit/generating" element={<AuditGeneratingPage />} />
                <Route path="/audit/report/:id" element={<AuditReportPage />} />
              </Route>

              {/* Regular app routes */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/flows" element={<FlowsIndexRedirect />} />
              <Route path="/pipelines" element={<FlowsIndexRedirect />} />
              <Route path="/flows/:flowId" element={<FlowPage />} />
              <Route path="/flows/:flowId/documentation" element={<FlowDocumentationPage />} />
              <Route path="/flows/:flowId/analytics" element={<FlowAnalyticsPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/signals" element={<FeatureGate feature="signals"><SignalsPage /></FeatureGate>} />
              <Route path="/signals/custom" element={<FeatureGate feature="signals"><CustomSignalsPage /></FeatureGate>} />
              <Route path="/signals/agent" element={<FeatureGate feature="signals"><SignalAgentPage /></FeatureGate>} />

              <Route path="/contacts/:contactId" element={<UserProfilePage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/groups/:groupId" element={<GroupDetailPage />} />
              <Route path="/settings/groups" element={<GroupSettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/settings/ai-tools" element={<Navigate to="/team?tab=ai-tools" replace />} />
              <Route path="/integrations/:integrationName/advanced" element={<IntegrationAdvancedSettingsPage />} />
              <Route path="/integrations/church-online/advanced" element={<FeatureGate feature="church_online"><ChurchOnlineAdvancedPage /></FeatureGate>} />
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
              <Route path="/prayer" element={<PrayerHubPage />} />
              <Route path="/forms" element={<FeatureGate feature="forms"><FormsListPage /></FeatureGate>} />
              <Route path="/forms/:id" element={<FeatureGate feature="forms"><FormBuilderPage /></FeatureGate>} />
              <Route path="/forms/:id/submissions" element={<FeatureGate feature="forms"><FormSubmissionsPage /></FeatureGate>} />

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

              {/* Public org-scoped routes (must be after all specific top-level routes) */}
              <Route path="/:slug/groups" element={<GroupDirectoryPage />} />
              <Route path="/:slug/content" element={<PublicContentPage />} />
              <Route path="/:slug/content/videos/:id" element={<PublicContentVideoPage />} />
              <Route path="/:slug/pray" element={<PublicPrayerPage />} />
              <Route path="/:orgSlug/f/:formSlug" element={<PublicFormPage />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </FlowProvider>
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
