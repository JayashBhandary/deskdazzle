import React, { useState, createContext, useEffect, useMemo } from 'react';
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
import Profile from './pages/Profile';
import Calculator from './pages/Calculator';
import Donate from './pages/Donate';
import Docs from './pages/Docs';
import Shortcuts from './components/Shortcuts';
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

  // Auth state is the single source of truth for who's signed in.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoggedIn(!!currentUser);
    });
    return () => unsubscribe();
  }, []);

  // All per-user state (profile/theme/todos/desktop) is loaded and persisted
  // through one shared Realtime Database listener + debounced writer.
  const { theme, setTheme, todos, setTodos, desktop, setDesktop, projects, setProjects, profile } = useUserData(user);

  // Tailwind's `dark:` variant (and portaled shadcn overlays rendered on
  // document.body) key off a `.dark` class on <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!theme);
  }, [theme]);

  // Memoize the store so consumers only re-render when a value actually
  // changes, not on every App render.
  const store = useMemo(
    () => ({ theme, setTheme, isLoggedIn, setIsLoggedIn, user, todos, setTodos, desktop, setDesktop, projects, setProjects, profile }),
    [theme, setTheme, isLoggedIn, user, todos, setTodos, desktop, setDesktop, projects, setProjects, profile]
  );

  return (
    <ThemeContext.Provider value={store}>
      <WorkspaceProvider user={user}>
      <TimeProvider>
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
