import React, { useContext } from 'react'
import { ThemeContext } from '../App';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';

function Header() {

  const provider = new GoogleAuthProvider();

  const { theme, setTheme, isLoggedIn } = useContext(ThemeContext);

  const currentUser = auth.currentUser;


  const handleThemeChange = () => {
    setTheme(theme === false ? true : false);
  };

  const googlePop = async () => {

    try {
      signInWithPopup(auth, provider)
        .then(async (result) => {
          const user = result.user;

          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            console.log("Document data:", docSnap.data());
          } else {
            await setDoc(doc(db, "users", user.uid), {
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              uid: user.uid,
              todos: []
            })
          }

        }).catch((error) => {
          // Handle Errors here.
          const errorCode = error.code;

          console.log(errorCode)
          // ...
        });
    } catch (error) {
      console.log(error.message);
    }
  };


  return (
    <header >
      <Link to='/' style={{ textDecoration: 'none' }}>
        <div style={{ padding: "14px" }}>
          <h2 className={theme ? "dark" : "light"}>DƎSK</h2>
          <h4 className={theme ? "dark" : "light"}>DAZZLƎ</h4>
        </div>
      </Link>
      <nav>
        <Link className={`header_button ${theme ? "dark" : "light"}`} to='/apps'>📱 Apps</Link>

        <Link className={`header_button ${theme ? "dark" : "light"}`} to='/blogs'>📖 Blog</Link>
      </nav>
      <div style={{ display: "flex", alignItems: "center" }}>
        <input
          className='theme-switch'
          type="checkbox"
          id="theme-switch"
          checked={theme}
          onChange={handleThemeChange}
        />
        <label style={{ margin: '12px', fontSize: '14px', cursor: 'pointer' }} htmlFor='theme-switch'>{theme ? "🌙" : "☀️"}</label>
        
        {
          isLoggedIn
            ? <label className={`header_button ${theme ? "dark" : "light"}`} onClick={googlePop}>🔑</label>
            : <Link style={{ width: '50px', height: '50px', padding: '0px', borderRadius: '50px' }} className={`header_button ${theme ? "dark" : "light"}`} to="/profile"><img alt='profile' style={{ borderRadius: '50px', width: '15px', height: '15pxpx', objectFit: 'cover' }} src={currentUser.photoURL} /></Link>
        }
      </div>
    </header>
  )
}

export default Header
/**      <button className={theme ? "dark": "light"} >🔒 Login</button> */

/**       <Link className={theme} to='/pricing'>Pricing</Link> */