import convert from 'convert';
import React, { useState, useContext, useEffect } from 'react'
import { ThemeContext } from '../App';
function UnitConverter() {
  const { theme } = useContext(ThemeContext);

  const [fromLength, setFromLength] = useState(null);
  const [toLength, setToLength] = useState(null);
  const [bothSelected, setBothSelected] = useState(null);
  const [inputValue, setInputValue] = useState(1)
  const [resultValue, setResultValue] = useState(0);

  useEffect(() => {
    if (fromLength && toLength) {
      setBothSelected(true)
      setResultValue(convert(inputValue, fromLength).to(toLength))
    } else {
      setBothSelected(false)
    }

  }, [fromLength, toLength, inputValue])
  return (
    <div className='page'>
      <div className='page__content'>

        <label>📏 UnitConverter</label>

        <div className='content'>
          <div className='content'>
            <div className='currency__page'>
              <div >
                <div className='custom-select'>
                  <p className='currency__label' for="fromlength">From:</p>
                  <select style={{ backgroundColor: theme ? "white" : "#f5f5f5" }} id="fromlength" name="length" value={fromLength} onChange={(e) => setFromLength(e.target.value)}>
                    <option>Select length</option>
                    <option value="millimeters">Millimetres</option>
                    <option value="centimeters">Centimetres</option>
                    <option value="inches">Inches</option>
                    <option value="feet">Feet</option>
                    <option value="meters">Meters</option>
                    <option value="yards">Yards</option>
                    <option value="kilometers">Kilometers</option>
                    <option value="miles">Miles</option>

                  </select>
                </div>
                <div className='custom-select'>
                  <p className='currency__label' for="tolength">To:</p>
                  <select style={{ backgroundColor: theme ? "white" : "#f5f5f5" }} id="tolength" name="length" value={toLength} onChange={(e) => setToLength(e.target.value)}>
                    <option>Select length</option>
                    <option value="millimeters">Millimetres</option>
                    <option value="centimeters">Centimetres</option>
                    <option value="inches">Inches</option>
                    <option value="feet">Feet</option>
                    <option value="meters">Meters</option>
                    <option value="yards">Yards</option>
                    <option value="kilometers">Kilometers</option>
                    <option value="miles">Miles</option>

                  </select>
                </div>
              </div>
              <div className='inputconvert'>
                {
                  bothSelected
                    ? <input min='0' style={{ backgroundColor: theme ? "white" : "#f5f5f5", textAlign: 'center' }} type='number' placeholder='1.00' value={inputValue} onChange={(e) => setInputValue(parseInt(e.target.value))} />
                    : <input disabled style={{ backgroundColor: theme ? "white" : "#f5f5f5", textAlign: 'center' }} type='number' placeholder='1.00' />
                }
                <h2>{resultValue > 0 ? resultValue.toFixed(2) : ""}</h2>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnitConverter