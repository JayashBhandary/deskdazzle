import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="flex h-full flex-col gap-2">
      <div className="rounded-lg bg-muted px-2.5 py-2 text-right">
        <div className="min-h-4 break-all font-mono text-xs text-muted-foreground">{expr || ' '}</div>
        <div className="break-all font-mono text-2xl font-extrabold">{result}</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-1.5">
        {KEYS.flat().map((key) => (
          <Button
            key={key}
            variant={key === '=' ? 'default' : OPS.has(key) ? 'outline' : 'secondary'}
            className={cn('h-full min-h-9 text-base', OPS.has(key) || key === '=' ? 'font-bold' : 'font-medium')}
            onClick={() => press(key)}
          >
            {key}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default CalculatorWidget
