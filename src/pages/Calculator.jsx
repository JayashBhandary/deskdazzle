import React, { useContext, useState, useEffect, useCallback } from 'react'
import { ThemeContext } from '../App';

const KEYS = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
];

const OPERATORS = { '÷': '/', '×': '*', '-': '-', '+': '+' };

function Calculator() {
  const { theme } = useContext(ThemeContext);
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');

  const evaluate = (raw) => {
    if (!raw) return '0';
    // Translate display symbols to JS operators and strip anything unsafe.
    const safe = raw
      .replace(/÷/g, '/')
      .replace(/×/g, '*')
      .replace(/%/g, '/100')
      .replace(/[^0-9+\-*/.() ]/g, '');
    try {
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${safe})`)();
      if (value === undefined || value === null || Number.isNaN(value) || !Number.isFinite(value)) {
        return 'Error';
      }
      return String(Math.round(value * 1e10) / 1e10);
    } catch {
      return 'Error';
    }
  };

  const press = useCallback((key) => {
    if (key === 'C') {
      setExpr('');
      setResult('0');
    } else if (key === '⌫') {
      setExpr((e) => e.slice(0, -1));
    } else if (key === '=') {
      setResult(evaluate(expr));
    } else if (key === '±') {
      setExpr((e) => (e.startsWith('-') ? e.slice(1) : '-' + e));
    } else {
      setExpr((e) => e + key);
    }
  }, [expr]);

  useEffect(() => {
    if (expr) setResult(evaluate(expr));
    else setResult('0');
  }, [expr]);

  useEffect(() => {
    const handler = (e) => {
      const k = e.key;
      if (/[0-9.]/.test(k)) press(k);
      else if (k === '+') press('+');
      else if (k === '-') press('-');
      else if (k === '*') press('×');
      else if (k === '/') press('÷');
      else if (k === '%') press('%');
      else if (k === 'Enter' || k === '=') press('=');
      else if (k === 'Backspace') press('⌫');
      else if (k === 'Escape') press('C');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [press]);

  return (
    <div className='page'>
      <div className='page__content'>
        <label>🧮 Calculator</label>
        <div className='content'>
          <div className='calc'>
            <div className='calc__display'>
              <div className='calc__expr'>{expr || ' '}</div>
              <div className='calc__result'>{result}</div>
            </div>
            <div className='calc__keys'>
              {KEYS.flat().map((key) => (
                <button
                  key={key}
                  className={`calc__key ${OPERATORS[key] || key === '÷' ? 'calc__key--op' : ''} ${key === '=' ? 'calc__key--eq' : ''} ${theme ? 'dark' : 'light'}`}
                  onClick={() => press(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Calculator
