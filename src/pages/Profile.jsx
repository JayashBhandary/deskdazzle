import React, { useContext } from 'react'
import { ThemeContext } from '../App';
import { signOut } from "firebase/auth"
import { auth } from '../firebaseConfig';


function Profile() {

    const currentUser = auth.currentUser;
    const { isLoggedIn } = useContext(ThemeContext);
    const handleLogout = () => {
        signOut(auth);

    }

    return (
        <div className='page'>
            <div className='page__content'>
                <label>Profile</label>
                <div className='content'>
                    {
                        !isLoggedIn
                            ? <div  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <img alt='profile' style={{ borderRadius: '100px', width:' 100px', height: '100px'}} src={currentUser?.photoURL} />
                                <div style={{height: '50px'}}></div>
                                <p style={{fontSize: '20px', letterSpacing: '5px',fontStretch: 'expanded'}}><span style={{fontWeight: '900'}}>NAME: </span> {currentUser?.displayName}</p>
                                <p style={{fontSize: '20px', letterSpacing: '5px',fontStretch: 'expanded'}}><span style={{fontWeight: '900'}}>EMAIL: </span>{currentUser?.email}</p>
                                <div style={{height: '100px'}}></div>
                                <p onClick={handleLogout} className='header_button'>Logout</p>
                            </div>
                            : <p onClick={handleLogout} className='header_button'>Login</p>
                    }
                </div>
            </div>
        </div>
    )
}

export default Profile