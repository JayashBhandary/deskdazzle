import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { cn } from '../../lib/utils';

const KEYS = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
];

const OPERATORS = { '÷': '/', '×': '*', '-': '-', '+': '+' };

function evaluate(raw) {
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
}

// The Calculator app — one component rendered by both the full page and the
// desktop widget. A `@container` root means the layout adapts to whatever width
// it's given: roomy display + tall keys on the page, compact display + keys that
// fill the available height in a small widget, reflowing live on resize.
function CalculatorApp() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');

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

  const keyVariant = (key) => {
    if (key === '=') return 'default';
    if (OPERATORS[key] || key === '%') return 'secondary';
    if (key === 'C' || key === '⌫' || key === '±') return 'secondary';
    return 'outline';
  };

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <Card className="mx-auto flex h-full min-h-0 w-full max-w-sm flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 @sm:gap-4">
          <div className="shrink-0 rounded-lg border bg-muted/50 px-2.5 py-2 text-right @sm:px-4 @sm:py-3">
            <div className="min-h-4 break-all font-mono text-xs text-muted-foreground @sm:min-h-5 @sm:text-sm">
              {expr || ' '}
            </div>
            <div
              className="break-all font-mono text-2xl font-semibold tabular-nums @sm:text-3xl"
              aria-live="polite"
            >
              {result}
            </div>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-4 gap-1.5 @sm:gap-2">
            {KEYS.flat().map((key) => (
              <Button
                key={key}
                variant={keyVariant(key)}
                className={cn(
                  'h-full min-h-9 text-base font-medium @sm:min-h-11 @sm:text-lg',
                  key === 'C' && 'text-destructive',
                )}
                onClick={() => press(key)}
              >
                {key}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CalculatorApp;
