import React, { useState, createContext, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Apps from './pages/Apps';
import Home from './pages/Home';
import Desktop from './pages/Desktop';
import Header from './components/Header';

// Merged "web-OS" apps (each a tabbed container over the old tools).
import Images from './pages/Images';
import Converters from './pages/Converters';
import Design from './pages/Design';
import Vault from './pages/Vault';

import BudgetTracker from './pages/BudgetTracker';
import Calender from './pages/Calender';
import ToDoList from './pages/ToDoList';
import Flashcards from './pages/Flashcards';
import Clock from './pages/Clock';
import Roadmap from './pages/Roadmap';
import { Toaster } from '@/components/ui/sonner';
import QRCodeGenerator from './pages/QRCodeGenerator';
import TranslationTool from './pages/TranslationTool';
import TextToSpeech from './pages/TextToSpeech';
import NoteTaking from './pages/NoteTaking';
import WeatherApp from './pages/WeatherApp';
import Footer from './components/Footer';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, trackEvent } from './firebaseConfig';
import { useUserData } from './hooks/useUserData';
import { useWorkspaces } from './lib/store/useWorkspaces';
import Profile from './pages/Profile';
import Calculator from './pages/Calculator';
import Donate from './pages/Donate';
import Docs from './pages/Docs';
import Shortcuts from './components/Shortcuts';
import Splash from './components/Splash';
import SettingsRuntime from './components/SettingsRuntime';
import Settings from './pages/Settings';
import { WorkspaceProvider } from './lib/store/WorkspaceProvider';
import { TimeProvider } from './lib/time/TimeProvider';




export const ThemeContext = createContext();

// Logs a page_view to Analytics on every route change. Must live inside the
// router so it can read the current location.
function RouteAnalytics() {
  const location = useLocation();
  useEffect(() => {
    trackEvent('page_view', { page_path: location.pathname });
  }, [location.pathname]);
  return null;
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
  // document.body) key off a `.dark` class on <html>. We wrap the switch in a
  // short-lived `theme-transition` class so every colour cross-fades smoothly
  // (see index.css) — but skip it on the first paint so the initial theme
  // doesn't animate in.
  const firstThemeRender = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    if (firstThemeRender.current) {
      firstThemeRender.current = false;
      root.classList.toggle('dark', !!theme);
      return;
    }
    root.classList.add('theme-transition');
    // Flush styles so the browser registers the transition before colours change.
    void root.offsetWidth;
    root.classList.toggle('dark', !!theme);
    const timer = setTimeout(() => root.classList.remove('theme-transition'), 300);
    return () => clearTimeout(timer);
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
      <TimeProvider>
      <Splash show={showSplash} />
      <BrowserRouter>
        <RouteAnalytics />
        <Shortcuts />
        <SettingsRuntime />
        <div className={`app flex min-h-screen flex-col bg-background text-foreground ${theme ? "dark" : "light"}`}>
          <Link
            className="fixed bottom-4 right-4 z-40 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
            to='/donate'
          >
            🙌 Donate
          </Link>
          <Header />
          <main className="min-h-screen flex-1">
          <Routes>
            <Route path='/' element={<Desktop />} />
            <Route path='/home' element={<Home />} />
            <Route path='/apps' element={<Apps />} />
            <Route path='/profile' element={<Profile />} />
            <Route path='/settings' element={<Settings />} />
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
            <Route path='/roadmap' element={<Roadmap />} />
            <Route path='/qrcode-generator' element={<QRCodeGenerator />} />
            <Route path='/calender' element={<Calender />} />
            <Route path='/translation-tool' element={<TranslationTool />} />
            <Route path='/text-to-speech' element={<TextToSpeech />} />
            <Route path='/note-taking' element={<NoteTaking />} />
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
          </main>
          <Footer/>
          <Toaster theme={theme ? 'dark' : 'light'} />
        </div>
      </BrowserRouter>
      </TimeProvider>
      </WorkspaceProvider>
    </ThemeContext.Provider>
  );
}

export default App;
