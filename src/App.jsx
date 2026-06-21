import React, { useState, createContext, useEffect, useMemo } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import './style.css';
import './tools.css';
import './desktop.css';
import './ui.css';
import Apps from './pages/Apps';
import Home from './pages/Home';
import Desktop from './pages/Desktop';
import Header from './components/Header';

import ColorPickers from './pages/ColorPicker';
import BudgetTracker from './pages/BudgetTracker';
import Calender from './pages/Calender';
import CurrencyConverter from './pages/CurrencyConverter';
import UnitConverter from './pages/UnitConverter';
import ToDoList from './pages/ToDoList';
import PasswordGenerator from './pages/PasswordGenerator';
import TextEncryptor from './pages/TextEncryptor';
import GradientGenerator from './pages/GradientGenerator';
import ImageResizer from './pages/ImageResizer';
import MarkdownPreviewer from './pages/MarkdownPreviewer';
import QRCodeGenerator from './pages/QRCodeGenerator';
import ImageOptimizer from './pages/ImageOptimizer';
import TranslationTool from './pages/TranslationTool';
import URLShortner from './pages/URLShortener';
import TextToSpeech from './pages/TextToSpeech';
import NoteTaking from './pages/NoteTaking';
import RecipeFinder from './pages/RecipeFinder';
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
  const { theme, setTheme, todos, setTodos, desktop, setDesktop, profile } = useUserData(user);

  // Memoize the store so consumers only re-render when a value actually
  // changes, not on every App render.
  const store = useMemo(
    () => ({ theme, setTheme, isLoggedIn, setIsLoggedIn, user, todos, setTodos, desktop, setDesktop, profile }),
    [theme, setTheme, isLoggedIn, user, todos, setTodos, desktop, setDesktop, profile]
  );

  return (
    <ThemeContext.Provider value={store}>
      <BrowserRouter>
        <RouteAnalytics />
        <Shortcuts />
        <div className={`app ${theme ? "dark" : "light"}`}>
        <Link className={`header_button donate_link`} style={{background: theme ? "#ffffff": "#171717", color: theme ? "#171717" : "#ffffff",border: 'none'}} to='/donate'>🙌 Donate</Link>
          <Header />
          <main style={{height: '100%',minHeight: '100vh'}}>
          <Routes>
            <Route path='/' element={<Desktop />} />
            <Route path='/home' element={<Home />} />
            <Route path='/apps' element={<Apps />} />
            <Route path='/profile' element={<Profile />} />
            {/* App Routes */}
            <Route path="/currency-converter" element={<CurrencyConverter />} />
            <Route path='/budget-tracker' element={<BudgetTracker />} />
            <Route path="/unit-converter" element={<UnitConverter />} />
            <Route path="/to-do-list"  element={<ToDoList />} />
            <Route path="/password-generator" element={<PasswordGenerator />} />
            <Route path="/text-encryptor" element={<TextEncryptor />} />
            <Route path='/color-picker' element={<ColorPickers />} />
            <Route path="/gradient-generator" element={<GradientGenerator />} />
            <Route path='/image-resizer' element={<ImageResizer />} />
            <Route path='/markdown-previewer' element={<MarkdownPreviewer />} />
            <Route path='/qrcode-generator' element={<QRCodeGenerator />} />
            <Route path='/calender' element={<Calender />} />
            <Route path='/image-optimizer' element={<ImageOptimizer />} />
            <Route path='/translation-tool' element={<TranslationTool />} />
            <Route path='/url-shortner' element={<URLShortner />} />
            <Route path='/text-to-speech' element={<TextToSpeech />} />
            <Route path='/note-taking' element={<NoteTaking />} />
            <Route path='/recipe-finder' element={<RecipeFinder />} />
            <Route path='/weather' element={<WeatherApp />} />
            <Route path='/calculator' element={<Calculator />} />   
            <Route path='/docs' element={<Docs />} />    
            <Route path='/donate' element={<Donate />} />      
          </Routes>
          </main>
          <Footer/>
        </div>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}

export default App;
