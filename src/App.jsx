import React, { useState, createContext, useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import './App.css';
import './style.css';
import Apps from './pages/Apps';
import Blog from './pages/Blog';
import Home from './pages/Home';
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
import { auth, db } from './firebaseConfig';
import Profile from './pages/Profile';
import Calculator from './pages/Calculator';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Donate from './pages/Donate';
import Docs from './pages/Docs';




export const ThemeContext = createContext();

function App() {

  const [theme, setTheme] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const [todos, setTodos] = useState([])

  useEffect(()=>{
    if(auth.currentUser !== null) {
      const docRef = doc(db, "users", auth.currentUser?.uid);
        async function getData(){
          const docSnap = await getDoc(docRef);
          const todoss = docSnap?.data()['todos']
          const themes = docSnap?.data()['theme']
          setTheme(themes)
          setTodos(todoss)
          console.log(todoss.length)
        }
        getData()
    } else {
      console.log("Please sign in")
    }
  },[isLoggedIn])

  useEffect(() => {
    if (auth.currentUser !== null) {
      const docRef = doc(db, "users", auth.currentUser?.uid);
      updateDoc(docRef, {
        theme: theme
      })
    } else {
      console.log("Please sign in")
    }
  }, [theme])


  useEffect(()=>{
    onAuthStateChanged(auth, (user) => {
      console.log(user)
      if(user == null) {
        setIsLoggedIn(true);
      }else {
        setIsLoggedIn(false)
      }
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoggedIn, setIsLoggedIn, todos, setTodos }}>
      <BrowserRouter>
        <div className={`app ${theme ? "dark" : "light"}`}>
        <Link className={`header_button donate_link`} style={{background: theme ? "#ffffff": "#171717", color: theme ? "#171717" : "#ffffff",border: 'none'}} to='/donate'>🙌 Donate</Link>
          <Header />
          <main style={{height: '100%',minHeight: '100vh'}}>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/apps' element={<Apps />} />
            <Route path='/blogs' element={<Blog />} />
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
