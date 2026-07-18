import React, { useState, useEffect, useCallback } from 'react';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const KEYS = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
];

const OPERATORS = { '÷': '/', '×': '*', '-': '-', '+': '+' };

function Calculator() {
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

  const keyVariant = (key) => {
    if (key === '=') return 'default';
    if (OPERATORS[key] || key === '%') return 'secondary';
    if (key === 'C' || key === '⌫' || key === '±') return 'secondary';
    return 'outline';
  };

  return (
    <ToolPage
      icon="🧮"
      title="Calculator"
      description="Quick arithmetic with full keyboard support — try typing an expression."
    >
      <Card className="mx-auto w-full max-w-sm">
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 px-4 py-3 text-right">
            <div className="min-h-5 break-all font-mono text-sm text-muted-foreground">
              {expr || ' '}
            </div>
            <div className="break-all font-mono text-3xl font-semibold tabular-nums" aria-live="polite">
              {result}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {KEYS.flat().map((key) => (
              <Button
                key={key}
                variant={keyVariant(key)}
                className={cn(
                  'h-12 text-lg font-medium',
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
    </ToolPage>
  )
}

export default Calculator
