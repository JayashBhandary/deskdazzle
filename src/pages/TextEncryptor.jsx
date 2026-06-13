import React, { useState, useContext } from 'react'
import CryptoJS from 'crypto-js';
import { ThemeContext } from '../App';

function TextEncryptor() {
  const { theme } = useContext(ThemeContext);
  const [text, setText] = useState("");
  const [screen, setScreen] = useState("encrypt");

  const [encrptedData, setEncrptedData] = useState("");
  const [decrptedData, setDecrptedData] = useState("");

  const secretPass = "XkhZG4fW2t2x";

  const encryptData = () => {
    const data = CryptoJS.AES.encrypt(
      JSON.stringify(text),
      secretPass
    ).toString();

    setEncrptedData(data);
  };

  const decryptData = () => {
    const bytes = CryptoJS.AES.decrypt(text, secretPass);
    const data = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    setDecrptedData(data);
  };

  const switchScreen = (type) => {
    setText("");
    setEncrptedData("");
    setDecrptedData("");
    setScreen(type);
  };

  const handleClick = () => {
    if (!text) return;

    if (screen === "encrypt") encryptData();
    else decryptData();
  };

  return (
    <div className='page'>
      <div className='page__content'>

        <label>🔒 TextEncryptor</label>

        <div className='content'>
          <div className="container">
            <div>
              <button
                className="header_button btn-left"
                style={{
                  fontSize: '24px',
                  padding: '16px',
                  
                  backgroundColor: screen === "encrypt" ? "#f5f5f5" : "#131313",
                  color: screen === "encrypt" ? "#131313" : "#f5f5f5"
                }}
                onClick={() => {
                  switchScreen("encrypt");
                }}
              >
                Encrypt
              </button>

              <button
                className="header_button btn-right"
                style={{
                  fontSize: '24px',
                  padding: '16px',
                  
                  backgroundColor: screen === "decrypt" ? "#f5f5f5" : "#131313",
                  color: screen === "encrypt" ? "#f5f5f5" : "#131313"
                }}
                onClick={() => {
                  switchScreen("decrypt");
                }}
              >
                Decrypt
              </button>
            </div>

            <div className="card">
              <input
              className={theme ? "dark": "light"}
                value={text}
                onChange={({ target }) => {
                  setText(target.value);
                }}
                name="text"
                type="text"
                placeholder={
                  screen === "encrypt" ? "Enter Text" : "Enter Encrypted Data"
                }
              />

              <button style={{color: theme ? "white": "black"}} className="submit-btn" onClick={handleClick}>
                {screen === "encrypt" ? "Encrypt" : "Decrypt"}
              </button>
            </div>

            {encrptedData || decrptedData ? (
              <div className="text_content">
                <h2>{screen === "encrypt" ? "Encrypted" : "Decrypted"} Data: </h2>
                <textarea style={{backgroundColor: theme ? "#171717" : "#ffffff", color: theme ? "#c7c7c7" : "#171717"}} rows="20" cols="40">{screen === "encrypt" ? encrptedData : decrptedData}</textarea>
              <p onClick={async()=>{
                try {
                  const data = {text: encrptedData}
                  await navigator.share(data);
                } catch (error) {
                  alert(error)
                }
              }}>Share</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TextEncryptor