import React, { useContext } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';

function Apps() {
  const { theme } = useContext(ThemeContext);

  return (
    <div className='page'>
      <div className='page__content'>

      <label>Apps</label>
      
      <div className='content'>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/currency-converter'><p style={{fontSize: '45px',padding: '10px'}}>💰</p><p>CurrencyConverter</p></Link>
      {/*<Link className={`header_button ${theme ? "dark": "light"}`} to='/budget-tracker'>💳 BudgetTracker</Link>*/}
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/unit-converter'><p style={{fontSize: '45px',padding: '10px'}}>📏</p><p>UnitConverter</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/to-do-list'><p style={{fontSize: '45px',padding: '10px'}}>📝</p><p>ToDoList</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/password-generator'><p style={{fontSize: '45px',padding: '10px'}}>🔑</p><p>PasswordGenerator</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/text-encryptor'><p style={{fontSize: '45px',padding: '10px'}}>🔒</p><p>TextEncryptor</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/color-picker'><p style={{fontSize: '45px',padding: '10px'}}>🎨</p><p>ColorPicker</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/gradient-generator'><p style={{fontSize: '45px',padding: '10px'}}>🌈</p><p>GradientGenerator</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/image-resizer'><p style={{fontSize: '45px',padding: '10px'}}>📐</p><p>ImageResizer</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/markdown-previewer'><p style={{fontSize: '45px',padding: '10px'}}>💻</p><p>MarkdownPreviewer</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/qrcode-generator'><p style={{fontSize: '45px',padding: '10px'}}>🔗</p><p>QRCodeGenerator</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/calender'><p style={{fontSize: '45px',padding: '10px'}}>📅</p><p>Calender</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/image-optimizer'><p style={{fontSize: '45px',padding: '10px'}}>📱</p><p>ImageOptimizer</p> </Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/translation-tool'><p style={{fontSize: '45px',padding: '10px'}}>💬</p><p>TranslationTool</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/url-shortner'><p style={{fontSize: '45px',padding: '10px'}}>🔗</p><p>URLShortner</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/text-to-speech'><p style={{fontSize: '45px',padding: '10px'}}>🗣️</p><p>TextToSpeech</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/note-taking'><p style={{fontSize: '45px',padding: '10px'}}>💡</p><p>NoteTaking</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/weather'><p style={{fontSize: '45px',padding: '10px'}}>🌦️</p><p>WeatherApp</p></Link>
      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/calculator'><p style={{fontSize: '45px',padding: '10px'}}>🧮</p><p>Calculator</p></Link>
      </div>
      </div>
    </div>
  )
}

export default Apps

/**      <Link style={{width: '145px', display: 'flex',flexDirection: 'column',alignItems: 'center'}} className={`header_button ${theme ? "dark": "light"}`} to='/recipe-finder'><p style={{fontSize: '45px',padding: '10px'}}>📜</p><p>RecipeFinder</p></Link> */