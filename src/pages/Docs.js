import React, { useContext } from 'react'
import { ThemeContext } from '../App';

function Docs() {
    const { theme } = useContext(ThemeContext);
    return (
        <div className='page'>
            <div className='page__content'>

                <label style={{ fontSize: '40px', fontWeight: '100' }}>🔧 Documentation</label>

                <div className='content'>

                    <div className='documentation'>
                        <div className='documentation__table'>
                            <ul>
                                <li><a className={theme ? "dark" : "light"} href='#welcome'>Welcome</a></li>
                                <li><a className={theme ? "dark" : "light"} href='#getting-started'>Getting Started</a></li>
                                <li><a className={theme ? "dark" : "light"} href='#installation'>Installation</a></li>
                                <li><a className={theme ? "dark" : "light"} href='#features'>Features</a></li>

                            </ul>
                        </div>
                        <a className={`${theme ? "dark" : "light"}`} href='#welcome' id='welcome'><p style={{ paddingTop: '70px' }}>Welcome to the documentation page for DeskDazzle, an all-in-one tool app designed to help you stay organized and efficient in your daily tasks. This page will provide an overview of the app's features, how to use them, and any other important information you need to know.</p></a>
                        <a className={`${theme ? "dark" : "light"}`} href='#getting-started' id='getting-started'>
                            <h2 style={{ paddingTop: '70px' }}>🏃 Getting Started</h2>
                            <p>To start using DeskDazzle, you first need to download and install the app on your device. DeskDazzle is available for Windows and macOS operating systems and can be downloaded from the official website. Once the app is installed, you can launch it and start exploring its features.</p>
                        </a>
                        <a className={theme ? "dark" : "light"} href='#installation' id='installation'>
                            <h2 style={{ paddingTop: '70px' }}>⚙️ Installation</h2>
                            <p>
                                <div style={{display: 'flex',flexDirection: 'column'}}>
                                <p>To install DeskDazzle as a PWA, follow these steps:</p>
                                <div style={{display: 'flex',justifyContent: 'space-between',alignItems: 'center'}}>
                                <section id='android'>ANDROID</section>
                                <section id='ios'>IOS+</section>
                                </div>
                                </div>
                            </p>
                        </a>
                        <a className={theme ? "dark" : "light"} href='#features' id='features'>
                            <h2 style={{ paddingTop: '70px' }}>💡 Features</h2>
                            <p>Deskdazzle comes with a variety of features that are designed to help you stay organized and increase your productivity. Some of the main features include:</p>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Docs