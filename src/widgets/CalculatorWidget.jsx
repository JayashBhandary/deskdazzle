import React, { useState, useEffect, useCallback } from 'react'

const KEYS = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
];
const OPS = new Set(['÷', '×', '-', '+']);

function evaluate(raw) {
  if (!raw) return '0';
  const safe = raw.replace(/÷/g, '/').replace(/×/g, '*').replace(/%/g, '/100').replace(/[^0-9+\-*/.() ]/g, '');
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${safe})`)();
    if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return 'Error';
    return String(Math.round(value * 1e10) / 1e10);
  } catch {
    return 'Error';
  }
}

function CalculatorWidget() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');

  const press = useCallback((key) => {
    if (key === 'C') { setExpr(''); setResult('0'); }
    else if (key === '⌫') setExpr((e) => e.slice(0, -1));
    else if (key === '=') setResult(evaluate(expr));
    else if (key === '±') setExpr((e) => (e.startsWith('-') ? e.slice(1) : '-' + e));
    else setExpr((e) => e + key);
  }, [expr]);

  useEffect(() => { setResult(expr ? evaluate(expr) : '0'); }, [expr]);

  return (
    <div className='widget calcw'>
      <div className='calcw__display'>
        <div className='calcw__expr'>{expr || ' '}</div>
        <div className='calcw__result'>{result}</div>
      </div>
      <div className='calcw__keys'>
        {KEYS.flat().map((key) => (
          <button
            key={key}
            className={`calcw__key ${OPS.has(key) ? 'calcw__key--op' : ''} ${key === '=' ? 'calcw__key--eq' : ''}`}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}

export default CalculatorWidget
