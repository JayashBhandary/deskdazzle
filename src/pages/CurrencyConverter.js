import React, { useState, useContext, useEffect } from 'react'
import { ThemeContext } from '../App';
function CurrencyConverter() {
  const { theme } = useContext(ThemeContext);
  const [fromCurrency, setFromCurrency] = useState(null);
  const [toCurrency, setToCurrency] = useState(null);
  const [bothSelected, setBothSelected] = useState(null);
  const [inputValue, setInputValue] = useState(1)
  const [resultValue, setResultValue] = useState(0);


  useEffect(() => {
    const api = "https://api.exchangerate-api.com/v4/latest/";
    console.log(`${fromCurrency} => ${toCurrency} = ${inputValue}`)
    if (fromCurrency && toCurrency) {
      setBothSelected(true)
      fetch(`${api}${fromCurrency}`)
        .then(response => response.json())
        .then(data => {
          let fromRate = data.rates[fromCurrency]
          let toRate = data.rates[toCurrency]
          setResultValue((toRate / fromRate) * inputValue)
        })
      /**/
    } else {
      setBothSelected(false)
    }
  }, [fromCurrency, toCurrency, inputValue])

  return (
    <div className='page'>
      <div className='page__content'>

        <label>💰 CurrencyConverter</label>

        <div className='content'>
          <div className='currency__page'>
            <div >
              <div className='custom-select'>
                <p className='currency__label' for="fromcurrency">From:</p>
                <select style={{ backgroundColor: theme ? "white" : "#f5f5f5" }} id="fromcurrency" name="currency" value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)}>
                  <option>Select currency</option>
                  <option value="INR">Indian Rupee</option>
                  <option value="USD">US Dollar</option>
                  <option value="EUR">Euro</option>
                  <option value="JPY">Japanese Yen</option>
                  <option value="GBP">British Pound Sterling</option>
                  <option value="AUD">Australian Dollar</option>
                  <option value="CAD">Canadian Dollar</option>
                  <option value="CHF">Swiss Franc</option>
                  <option value="CNY">Chinese Yuan</option>
                  <option value="NZD">New Zealand Dollar</option>
                  <option value="HKD">Hong Kong Dollar</option>
                </select>
              </div>
              <div className='custom-select'>
                <p className='currency__label' for="tocurrency">To:</p>
                <select style={{ backgroundColor: theme ? "white" : "#f5f5f5" }} id="tocurrency" name="currency" value={toCurrency} onChange={(e) => setToCurrency(e.target.value)}>
                  <option>Select currency  </option>
                  <option value="INR">Indian Rupee</option>
                  <option value="USD">US Dollar</option>
                  <option value="EUR">Euro</option>
                  <option value="JPY">Japanese Yen</option>
                  <option value="GBP">British Pound Sterling</option>
                  <option value="AUD">Australian Dollar</option>
                  <option value="CAD">Canadian Dollar</option>
                  <option value="CHF">Swiss Franc</option>
                  <option value="CNY">Chinese Yuan</option>
                  <option value="NZD">New Zealand Dollar</option>
                  <option value="HKD">Hong Kong Dollar</option>
                </select>
              </div>
            </div>
            <div className='inputconvert'>
              {
                bothSelected
                  ? <input min='0' style={{ backgroundColor: theme ? "white" : "#f5f5f5", textAlign: 'center' }} type='number' placeholder='1.00' value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                  : <input disabled style={{ backgroundColor: theme ? "white" : "#f5f5f5", textAlign: 'center' }} type='number' placeholder='1.00' />
              }
              <h2 style={{ cursor: 'pointer' }} ><p>{resultValue > 0 ? resultValue.toFixed(2) : ""}</p></h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CurrencyConverter
