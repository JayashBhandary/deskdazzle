import React, { useState, createContext, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import { Toaster } from '@/components/ui/sonner';

// Route pages are code-split (React.lazy): each page's JS — and the heavy tool
// it hosts (Excel/Word/PowerPoint/PDF/Drive) — is fetched only when its route is
// visited, keeping the initial bundle small. Rendered inside a <Suspense>
// boundary (see RoutedBoundary). Home is the landing route ('/') so it stays
// eager for instant first paint; the Desktop ("Workspace") now lives at
// '/workspace' and is lazily loaded along with its heavy widgets.
import Home from './pages/Home';
const Desktop = lazy(() => import('./pages/Desktop'));
const Apps = lazy(() => import('./pages/Apps'));
const Images = lazy(() => import('./pages/Images'));
const Converters = lazy(() => import('./pages/Converters'));
const Design = lazy(() => import('./pages/Design'));
const Vault = lazy(() => import('./pages/Vault'));
const BudgetTracker = lazy(() => import('./pages/BudgetTracker'));
const Calender = lazy(() => import('./pages/Calender'));
const ToDoList = lazy(() => import('./pages/ToDoList'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const Clock = lazy(() => import('./pages/Clock'));
const Roadmap = lazy(() => import('./pages/Roadmap'));
const QRCodeGenerator = lazy(() => import('./pages/QRCodeGenerator'));
const TranslationTool = lazy(() => import('./pages/TranslationTool'));
const TextToSpeech = lazy(() => import('./pages/TextToSpeech'));
const NoteTaking = lazy(() => import('./pages/NoteTaking'));
const WordProcessor = lazy(() => import('./pages/WordProcessor'));
const Spreadsheet = lazy(() => import('./pages/Spreadsheet'));
const Slides = lazy(() => import('./pages/Slides'));
const Drive = lazy(() => import('./pages/Drive'));
const PdfTools = lazy(() => import('./pages/PdfTools'));
const Today = lazy(() => import('./pages/Today'));
const WeatherApp = lazy(() => import('./pages/WeatherApp'));
const Profile = lazy(() => import('./pages/Profile'));
const Calculator = lazy(() => import('./pages/Calculator'));
const Donate = lazy(() => import('./pages/Donate'));
const Docs = lazy(() => import('./pages/Docs'));
const Settings = lazy(() => import('./pages/Settings'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
import Footer from './components/Footer';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, trackEvent } from './firebaseConfig';
import { trackToolOpen, toolFromPath, trackOfflineSession } from './lib/analytics';
import { useUserData } from './hooks/useUserData';
import { useWorkspaces } from './lib/store/useWorkspaces';
import Shortcuts from './components/Shortcuts';
import Splash from './components/Splash';
import WelcomeTour from './components/WelcomeTour';
import SettingsRuntime from './components/SettingsRuntime';
import EntityMigration from './components/EntityMigration';
import ConsentBanner from './components/ConsentBanner';
import FileHandler from './components/FileHandler';
import AppBadge from './components/AppBadge';
import ErrorBoundary from './components/ErrorBoundary';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import { WorkspaceProvider } from './lib/store/WorkspaceProvider';
import { WorkspaceGraphProvider } from './lib/context/WorkspaceGraphProvider';
import { TimeProvider } from './lib/time/TimeProvider';




export const ThemeContext = createContext();

// The workspace ("/workspace") is a full-bleed OS-style surface: its floating
// widgets and dock sit at the bottom, so a page footer just collides with them.
// Hide it there; every other route keeps the footer.
function AppFooter() {
  const { pathname } = useLocation();
  if (pathname === '/workspace') return null;
  return <Footer />;
}

// Logs a page_view to Analytics on every route change. Must live inside the
// router so it can read the current location.
function RouteAnalytics() {
  const location = useLocation();
  useEffect(() => {
    trackEvent('page_view', { page_path: location.pathname });
    // A tool route counts as opening that tool; non-tool routes (home, settings,
    // legal) return null and are page_view-only.
    const tool = toolFromPath(location.pathname);
    if (tool) trackToolOpen(tool, 'route');
  }, [location.pathname]);
  return null;
}

// Error boundary around the routed content: a crash in one tool shows a
// fallback while Header/Footer stay usable. Keyed on pathname so navigating
// away clears a caught error automatically.
function RoutedBoundary({ children }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname} label="page">
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  // Whether onAuthStateChanged has fired at least once (auth resolved).
  const [authReady, setAuthReady] = useState(false);

  // Auth state is the single source of truth for who's signed in.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoggedIn(!!currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Offline-usage signal — DeskDazzle's core promise. Log once if we load
  // offline, and once when the connection drops mid-session.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) trackOfflineSession();
    const onOffline = () => trackOfflineSession();
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, []);

  // Workspaces ("Spaces") give per-workspace data isolation. The active
  // workspace scopes the desktop layout and every app's data.
  const {
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
  } = useWorkspaces(user);

  // All per-user state (profile/theme/todos/desktop) is loaded and persisted
  // through one shared Realtime Database listener + debounced writer, scoped to
  // the active workspace.
  const { theme, setTheme, todos, setTodos, desktop, setDesktop, projects, setProjects, profile, hydrated } = useUserData(user, activeWorkspaceId);

  // Splash cover: keep the screen covered until auth has resolved AND (for a
  // signed-in user) the first data snapshot has applied — so theme/layout never
  // visibly flip in. A hard timeout guarantees it never waits forever.
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const ready = authReady && (!user || hydrated);
  const showSplash = !ready && !splashTimedOut;

  // Tailwind's `dark:` variant (and portaled shadcn overlays rendered on
  // document.body) key off a `.dark` class on <html>. We cross-fade the switch
  // via the View Transitions API: the browser snapshots the page once and GPU-
  // crossfades old→new as two bitmaps (see ::view-transition-* in index.css).
  // This is O(1) in DOM size — unlike a per-element CSS transition, whose paint
  // cost scales with the number of open app windows and janks badly. We skip the
  // animation on first paint and for reduced-motion users (instant swap).
  const firstThemeRender = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    const swap = () => root.classList.toggle('dark', !!theme);

    if (firstThemeRender.current) {
      firstThemeRender.current = false;
      swap();
      return;
    }

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (typeof document !== 'undefined' && document.startViewTransition && !reduceMotion) {
      document.startViewTransition(swap);
    } else {
      swap();
    }
  }, [theme]);

  // Memoize the store so consumers only re-render when a value actually
  // changes, not on every App render.
  const store = useMemo(
    () => ({
      theme, setTheme, isLoggedIn, setIsLoggedIn, user, todos, setTodos,
      desktop, setDesktop, projects, setProjects, profile,
      workspaces, activeWorkspaceId, switchWorkspace, createWorkspace,
      renameWorkspace, deleteWorkspace,
    }),
    [theme, setTheme, isLoggedIn, user, todos, setTodos, desktop, setDesktop,
      projects, setProjects, profile, workspaces, activeWorkspaceId,
      switchWorkspace, createWorkspace, renameWorkspace, deleteWorkspace]
  );

  return (
    <ThemeContext.Provider value={store}>
      <WorkspaceProvider user={user} workspaceId={activeWorkspaceId}>
      <WorkspaceGraphProvider>
      <TimeProvider>
      <Splash show={showSplash} />
      <BrowserRouter>
        <RouteAnalytics />
        <FileHandler />
        <AppBadge />
        <Shortcuts />
        <SettingsRuntime />
        <EntityMigration />
        <div className={`app flex min-h-screen flex-col bg-background text-foreground ${theme ? "dark" : "light"}`}>
          <Header />
          <main className="flex-1">
          <RoutedBoundary>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/workspace' element={<Desktop />} />
            {/* Back-compat: the landing used to live at /home */}
            <Route path='/home' element={<Navigate to='/' replace />} />
            <Route path='/apps' element={<Apps />} />
            <Route path='/profile' element={<Profile />} />
            <Route path='/settings' element={<Settings />} />
            <Route path='/privacy' element={<Privacy />} />
            <Route path='/terms' element={<Terms />} />
            {/* Merged apps */}
            <Route path='/images' element={<Images />} />
            <Route path='/converters' element={<Converters />} />
            <Route path='/design' element={<Design />} />
            <Route path='/vault' element={<Vault />} />

            {/* Standalone tools */}
            <Route path='/budget-tracker' element={<BudgetTracker />} />
            <Route path="/to-do-list"  element={<ToDoList />} />
            <Route path='/flashcards' element={<Flashcards />} />
            <Route path='/clock' element={<Clock />} />
            <Route path='/drive' element={<Drive />} />
            <Route path='/roadmap' element={<Roadmap />} />
            <Route path='/qrcode-generator' element={<QRCodeGenerator />} />
            <Route path='/calender' element={<Calender />} />
            <Route path='/today' element={<Today />} />
            <Route path='/translation-tool' element={<TranslationTool />} />
            <Route path='/text-to-speech' element={<TextToSpeech />} />
            <Route path='/note-taking' element={<NoteTaking />} />
            <Route path='/word' element={<WordProcessor />} />
            <Route path='/excel' element={<Spreadsheet />} />
            <Route path='/powerpoint' element={<Slides />} />
            <Route path='/pdf' element={<PdfTools />} />
            <Route path='/weather' element={<WeatherApp />} />
            <Route path='/calculator' element={<Calculator />} />
            <Route path='/docs' element={<Docs />} />
            <Route path='/donate' element={<Donate />} />

            {/* Back-compat redirects: old tool paths → merged app + tab */}
            <Route path='/image-resizer' element={<Navigate to='/images?tab=resize' replace />} />
            <Route path='/image-optimizer' element={<Navigate to='/images?tab=optimize' replace />} />
            <Route path='/batch-image-converter' element={<Navigate to='/images?tab=batch' replace />} />
            <Route path='/data-converter' element={<Navigate to='/converters?tab=data' replace />} />
            <Route path='/unit-converter' element={<Navigate to='/converters?tab=units' replace />} />
            <Route path='/currency-converter' element={<Navigate to='/converters?tab=currency' replace />} />
            <Route path='/color-picker' element={<Navigate to='/design?tab=picker' replace />} />
            <Route path='/gradient-generator' element={<Navigate to='/design?tab=gradient' replace />} />
            <Route path='/password-generator' element={<Navigate to='/vault?tab=passwords' replace />} />
            <Route path='/text-encryptor' element={<Navigate to='/vault?tab=encrypt' replace />} />
            <Route path='/markdown-previewer' element={<Navigate to='/note-taking' replace />} />
            <Route path='/pomodoro' element={<Navigate to='/clock?tab=focus' replace />} />
          </Routes>
          </RoutedBoundary>
          </main>
          <AppFooter/>
          <ConsentBanner />
          <PwaUpdatePrompt />
          <WelcomeTour blocked={showSplash} />
          <Toaster theme={theme ? 'dark' : 'light'} />
        </div>
      </BrowserRouter>
      </TimeProvider>
      </WorkspaceGraphProvider>
      </WorkspaceProvider>
    </ThemeContext.Provider>
  );
}

export default App;
