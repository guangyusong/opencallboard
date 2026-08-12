import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Construction, Globe2, Settings, UsersRound } from "lucide-react";
import { AppShell } from "./components/AppShell.jsx";
import { EmptyState, PageHeader } from "./components/ui.jsx";
import { markCallboardRouteReady } from "./lib/performanceProbe.js";
import { StoreProvider, useAppStore } from "./store.jsx";

const DashboardScreen = lazy(() => import("./screens/DashboardScreens.jsx").then((module) => ({ default: module.DashboardScreen })));
const AbstractsScreen = lazy(() => import("./screens/ProgramScreens.jsx").then((module) => ({ default: module.AbstractsScreen })));
const AgendaScreen = lazy(() => import("./screens/ProgramScreens.jsx").then((module) => ({ default: module.AgendaScreen })));
const SettingsScreen = lazy(() => import("./screens/SettingsScreens.jsx").then((module) => ({ default: module.SettingsScreen })));
const FormBuilderScreen = lazy(() => import("./screens/FormScreens.jsx").then((module) => ({ default: module.FormBuilderScreen })));
const SubmissionFormsScreen = lazy(() => import("./screens/FormScreens.jsx").then((module) => ({ default: module.SubmissionFormsScreen })));
const EmbedsScreen = lazy(() => import("./screens/EmbedScreens.jsx").then((module) => ({ default: module.EmbedsScreen })));
const PublicEmbedScreen = lazy(() => import("./screens/EmbedScreens.jsx").then((module) => ({ default: module.PublicEmbedScreen })));
const FileRequestsScreen = lazy(() => import("./screens/PortalScreens.jsx").then((module) => ({ default: module.FileRequestsScreen })));
const PortalFilesScreen = lazy(() => import("./screens/PortalScreens.jsx").then((module) => ({ default: module.PortalFilesScreen })));
const PortalFormsScreen = lazy(() => import("./screens/PortalScreens.jsx").then((module) => ({ default: module.PortalFormsScreen })));
const PortalTasksScreen = lazy(() => import("./screens/PortalScreens.jsx").then((module) => ({ default: module.PortalTasksScreen })));
const ResourcesScreen = lazy(() => import("./screens/PortalScreens.jsx").then((module) => ({ default: module.ResourcesScreen })));
const PublicCfpScreen = lazy(() => import("./screens/PublicScreens.jsx").then((module) => ({ default: module.PublicCfpScreen })));
const SpeakerPortalScreen = lazy(() => import("./screens/PublicScreens.jsx").then((module) => ({ default: module.SpeakerPortalScreen })));
const CommunicationsScreen = lazy(() => import("./screens/CommunicationsScreens.jsx").then((module) => ({ default: module.CommunicationsScreen })));
const IntegrationScreen = lazy(() => import("./screens/IntegrationScreens.jsx").then((module) => ({ default: module.IntegrationScreen })));
const EvaluationScreen = lazy(() => import("./screens/EvaluationScreens.jsx").then((module) => ({ default: module.EvaluationScreen })));
const OrganizerLoginScreen = lazy(() => import("./screens/AuthScreens.jsx").then((module) => ({ default: module.OrganizerLoginScreen })));
const AccessGrantScreen = lazy(() => import("./screens/AuthScreens.jsx").then((module) => ({ default: module.AccessGrantScreen })));
const AccessRequiredScreen = lazy(() => import("./screens/AuthScreens.jsx").then((module) => ({ default: module.AccessRequiredScreen })));
const EventTeamScreen = lazy(() => import("./screens/AuthScreens.jsx").then((module) => ({ default: module.EventTeamScreen })));
const ParticipantsScreen = lazy(() => import("./screens/ParticipantScreens.jsx").then((module) => ({ default: module.ParticipantsScreen })));
const CrmScreen = lazy(() => import("./screens/CrmScreens.jsx").then((module) => ({ default: module.CrmScreen })));
const AirtableScreen = lazy(() => import("./screens/AirtableScreens.jsx").then((module) => ({ default: module.AirtableScreen })));
const LandingScreen = lazy(() => import("./screens/LandingScreen.jsx").then((module) => ({ default: module.LandingScreen })));

function currentRoute() {
  const value = window.location.hash.replace(/^#/, "") || "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function GenericScreen({ title, subtitle = "This secondary module is represented as an honest placeholder in the current release.", icon = Construction }) {
  return <div className="page"><PageHeader title={title} subtitle={subtitle} icon={icon} /><EmptyState icon={icon} title={`${title} is not enabled yet`} description="No data is written from this placeholder. Use the implemented program workflows in the organizer navigation." /></div>;
}

function RoutedApp() {
  const { session, hydrated, sharedAvailable } = useAppStore();
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (hydrated) markCallboardRouteReady(route);
  }, [hydrated, route]);
  const navigate = (next) => { window.location.hash = next; };

  const publicAliasRoute = hydrated && session?.role !== "organizer"
    ? {
        "/sessions": "/embed/embed_callboard_judge_sessions",
        "/schedule": "/embed/embed_callboard_judge_itinerary",
        "/agenda": "/embed/embed_callboard_judge_agenda",
        "/speakers": "/embed/embed_callboard_judge_speaker_list",
        "/gallery": "/embed/embed_callboard_judge_gallery",
      }[route]
    : null;

  const anonymousScreen = route === "/" || route === "/home"
    ? <LandingScreen />
    : publicAliasRoute
    ? <PublicEmbedScreen route={publicAliasRoute} />
    : route === "/organizer-login"
    ? <OrganizerLoginScreen />
    : route.startsWith("/access/")
      ? <AccessGrantScreen token={decodeURIComponent(route.slice("/access/".length))} />
      : route === "/submit" || route.startsWith("/submit/") || route.startsWith("/public/cfp/")
        ? <PublicCfpScreen route={route} onNavigate={navigate} />
      : route.startsWith("/embed/")
        ? <PublicEmbedScreen route={route} />
        : null;
  const speakerRoute = route === "/speaker" || route === "/portal"
    ? "/speaker-portal"
    : route === "/my-submissions"
      ? "/speaker-portal/submissions"
      : route;
  const speakerScreen = speakerRoute === "/speaker-portal" || speakerRoute.startsWith("/speaker-portal/")
    ? <SpeakerPortalScreen route={speakerRoute} onNavigate={navigate} />
    : null;
  const reviewerRoutes = ["/reviewer", "/reviews", "/review-queue", "/reviewer-queue", "/my-reviews", "/assignments"];

  const screen = useMemo(() => {
    if (route === "/dashboard") return <DashboardScreen onNavigate={navigate} />;
    if (route === "/program") return <DashboardScreen onNavigate={navigate} />;
    if (route === "/abstracts") return <AbstractsScreen onNavigate={navigate} />;
    if (route === "/agenda") return <AgendaScreen onNavigate={navigate} />;
    if (route === "/settings") return <SettingsScreen onNavigate={navigate} />;
    if (route === "/submission-forms") return <SubmissionFormsScreen onNavigate={navigate} />;
    if (route.startsWith("/submission-form/")) return <FormBuilderScreen formId={route.split("/")[2]} onNavigate={navigate} />;
    if (route === "/portal-tasks") return <PortalTasksScreen onNavigate={navigate} />;
    if (route === "/portal-forms") return <PortalFormsScreen onNavigate={navigate} />;
    if (route === "/file-requests") return <FileRequestsScreen onNavigate={navigate} />;
    if (route === "/resources") return <ResourcesScreen onNavigate={navigate} />;
    if (["/portal-files", "/program-files", "/files"].includes(route)) return <PortalFilesScreen onNavigate={navigate} />;
    if (route === "/embeds") return <EmbedsScreen onNavigate={navigate} />;
    if (route === "/marketing" || route === "/communications") return <CommunicationsScreen onNavigate={navigate} />;
    if (route === "/integrations") return <IntegrationScreen onNavigate={navigate} />;
    if (route === "/integrations/airtable" || route === "/airtable") return <AirtableScreen onNavigate={navigate} />;
    if (route === "/submissions") return <AbstractsScreen onNavigate={navigate} />;
    if (route === "/sessions") return <AgendaScreen onNavigate={navigate} />;
    if (route === "/evaluation") return <EvaluationScreen onNavigate={navigate} />;
    if (reviewerRoutes.includes(route)) return <EvaluationScreen onNavigate={navigate} />;
    if (route === "/crm") return <CrmScreen onNavigate={navigate} />;
    if (["/participants", "/speakers", "/contacts"].includes(route)) return <ParticipantsScreen onNavigate={navigate} />;
    if (route === "/portals") return <GenericScreen title="Portals" subtitle="Portal configuration is not enabled in this release; Tasks, Forms, File Requests, Resources, and Files are implemented separately." icon={Globe2} />;
    if (route === "/event-team") return <EventTeamScreen />;
    return <GenericScreen title={route.slice(1).replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Callboard"} icon={Settings} />;
  }, [route]);

  const loading = <div className="route-loading"><span /></div>;
  if (anonymousScreen) return <Suspense fallback={loading}>{anonymousScreen}</Suspense>;
  if (!hydrated) return loading;
  if (speakerScreen) {
    if (sharedAvailable && !session) return <Suspense fallback={loading}><AccessRequiredScreen /></Suspense>;
    if (sharedAvailable && !["speaker", "organizer"].includes(session?.role)) return <Suspense fallback={loading}><AccessRequiredScreen denied /></Suspense>;
    return <Suspense fallback={loading}>{speakerScreen}</Suspense>;
  }
  if (sharedAvailable && !session) return <Suspense fallback={loading}><OrganizerLoginScreen /></Suspense>;
  if (sharedAvailable && session?.role === "reviewer" && (route === "/evaluation" || reviewerRoutes.includes(route))) return <Suspense fallback={loading}><EvaluationScreen onNavigate={navigate} /></Suspense>;
  if (sharedAvailable && session?.role !== "organizer") return <Suspense fallback={loading}><AccessRequiredScreen denied /></Suspense>;
  return <AppShell route={route} onNavigate={navigate}><Suspense fallback={loading}>{screen}</Suspense></AppShell>;
}

export function App() {
  return <StoreProvider><RoutedApp /></StoreProvider>;
}
