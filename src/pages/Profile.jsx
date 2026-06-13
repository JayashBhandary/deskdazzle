import React, { useContext } from 'react'
import { ThemeContext } from '../App';
import { signOut } from "firebase/auth"
import { auth } from '../firebaseConfig';


function Profile() {

    const { isLoggedIn, user } = useContext(ThemeContext);
    const handleLogout = () => {
        signOut(auth);
    }

    return (
        <div className='page'>
            <div className='page__content'>
                <label>Profile</label>
                <div className='content'>
                    {
                        isLoggedIn
                            ? <div  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <img alt='profile' style={{ borderRadius: '100px', width:' 100px', height: '100px', objectFit: 'cover'}} src={user?.photoURL} />
                                <div style={{height: '50px'}}></div>
                                <p style={{fontSize: '20px', letterSpacing: '5px',fontStretch: 'expanded'}}><span style={{fontWeight: '900'}}>NAME: </span> {user?.displayName}</p>
                                <p style={{fontSize: '20px', letterSpacing: '5px',fontStretch: 'expanded'}}><span style={{fontWeight: '900'}}>EMAIL: </span>{user?.email}</p>
                                <div style={{height: '100px'}}></div>
                                <p onClick={handleLogout} className='header_button' style={{ cursor: 'pointer' }}>Logout</p>
                            </div>
                            : <p style={{ fontSize: '20px' }}>Please sign in with the 🔑 button in the header.</p>
                    }
                </div>
            </div>
        </div>
    )
}

export default Profile