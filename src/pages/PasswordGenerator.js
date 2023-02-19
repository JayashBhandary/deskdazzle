import React, { useState, useEffect } from 'react'

function PasswordGenerator() {
  const [password, setPassword] = useState('')
  const [passwordLength, setPasswordLength] = useState(12)
  const [uppercase, setUppercase] = useState(true)
  const [lowercase, setLowercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(false)
  const [errors, setErrors] = useState({})

  const copyToClipboard = (text) => {
    navigator.permissions.query({ name: "clipboard-write" }).then((result) => {
      if (result.state === "granted" || result.state === "prompt") {
        navigator.clipboard.writeText(text).then(() => {
          // Alert the user that the action took place.
          // Nobody likes hidden stuff being done under the hood!
          alert("Copied to clipboard");
      });
      }
   
    });
  }

  const generatePassword = () => {
    setErrors({})
    if (!uppercase && !lowercase && !numbers && !symbols) {
      return setErrors('At least one character type must be selected')
    } else if (passwordLength === '0') {
      return setErrors('Password length cannot be 0')
    } else if (passwordLength === '') {
      return setErrors('Invalid password length')
    } else if (passwordLength > 80) {
      return setErrors('Password length cannot exceed 80 characters')
    }

    let password = ''
    for (let i = 0; i < passwordLength; i++) {
      let choice = random(0, 3)
      if (lowercase && choice === 0) {
        password += randomLower()
      } else if (uppercase && choice === 1) {
        password += randomUpper()
      } else if (symbols && choice === 2) {
        password += randomSymbol()
      } else if (numbers && choice === 3) {
        password += random(0, 9)
      } else {
        i--
      }
    }
    setPassword(password)
  }

  const random = (min = 0, max = 1) => {
    return Math.floor(Math.random() * (max + 1 - min) + min)
  }

  const randomLower = () => {
    return String.fromCharCode(random(97, 122))
  }

  const randomUpper = () => {
    return String.fromCharCode(random(65, 90))
  }

  const randomSymbol = () => {
    const symbols = "~*$%@#^&!?*'-=/,.{}()[]<>"
    return symbols[random(0, symbols.length - 1)]
  }

  useEffect(() => {
    generatePassword();
  }, [passwordLength])

  return (
    <div className='page'>
      <div className='page__content'>

        <label>🔑 PasswordGenerator</label>
        <div className='content'>
        
          <div>
          <div className='password' style={{textAlign: 'center',marginTop: '0px', marginBottom: '20px',cursor: 'pointer'}} onClick={()=>{copyToClipboard(password)}}>{password}</div>
            <div className='passwordcontainer'>
              <div className='subContainer'>
                <div className='option'>
                  <p>Password length: {passwordLength}</p>
                  
                </div>

                <div className='subContainer'>
                <input
                className='passrange'
                    type='range'
                    name='length'
                    min='4'
                    max='30'
                    defaultValue={passwordLength}
                    onChange={(e) => setPasswordLength(e.target.value)}
                  />
                </div>

                <div className='option'>
                  <input
                    type='checkbox'
                    name='uppercase'
                    defaultChecked={uppercase}
                    onChange={(e) => setUppercase(e.target.checked)}
                  />
                  <p>Include Uppercase Letters</p>

                </div>

                <div className='option'>
                  <input
                    type='checkbox'
                    name='lowercase'
                    defaultChecked={lowercase}
                    onChange={(e) => setLowercase(e.target.checked)}
                  />
                  <p>Include Lowercase Letters</p>

                </div>

                <div className='option'>
                  <input
                    type='checkbox'
                    name='numbers'
                    defaultChecked={numbers}
                    onChange={(e) => setNumbers(e.target.checked)}
                  />
                  <p>Include Numbers</p>

                </div>

                <div className='option'>
                  <input
                    type='checkbox'
                    name='symbols'
                    defaultChecked={symbols}
                    onChange={(e) => setSymbols(e.target.checked)}
                  />
                  <p>Include Symbols</p>

                </div>

                {errors.length && <li className='error'>{errors}</li>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PasswordGenerator

/**<div style={{textAlign: 'center'}} className='header_button'onClick={generatePassword}>
                  <label>Generate</label>
                </div> */