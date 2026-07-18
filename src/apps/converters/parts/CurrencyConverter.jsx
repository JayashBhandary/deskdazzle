import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, WifiOff } from 'lucide-react';
import ToolPage from '../../../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CURRENCIES = [
  { value: 'INR', label: 'Indian Rupee' },
  { value: 'USD', label: 'US Dollar' },
  { value: 'EUR', label: 'Euro' },
  { value: 'JPY', label: 'Japanese Yen' },
  { value: 'GBP', label: 'British Pound Sterling' },
  { value: 'AUD', label: 'Australian Dollar' },
  { value: 'CAD', label: 'Canadian Dollar' },
  { value: 'CHF', label: 'Swiss Franc' },
  { value: 'CNY', label: 'Chinese Yuan' },
  { value: 'NZD', label: 'New Zealand Dollar' },
  { value: 'HKD', label: 'Hong Kong Dollar' },
];

export function CurrencyPanel() {
  const [fromCurrency, setFromCurrency] = useState('');
  const [toCurrency, setToCurrency] = useState('');
  const [inputValue, setInputValue] = useState(1);
  const [resultValue, setResultValue] = useState(0);
  const [fetchFailed, setFetchFailed] = useState(false);

  const bothSelected = Boolean(fromCurrency && toCurrency);

  useEffect(() => {
    if (!fromCurrency || !toCurrency) return;
    const api = 'https://api.exchangerate-api.com/v4/latest/';
    let cancelled = false;
    fetch(`${api}${fromCurrency}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const fromRate = data.rates[fromCurrency];
        const toRate = data.rates[toCurrency];
        setResultValue((toRate / fromRate) * inputValue);
        setFetchFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFetchFailed(true);
      });
    return () => { cancelled = true; };
  }, [fromCurrency, toCurrency, inputValue]);

  const swap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-40 flex-1 gap-1.5">
              <Label htmlFor="fromcurrency">From</Label>
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger id="fromcurrency" className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.value} — {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={swap}
              disabled={!bothSelected}
              aria-label="Swap currencies"
            >
              <ArrowLeftRight className="size-4" />
            </Button>
            <div className="grid min-w-40 flex-1 gap-1.5">
              <Label htmlFor="tocurrency">To</Label>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger id="tocurrency" className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.value} — {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="currency-amount">Amount</Label>
            <Input
              id="currency-amount"
              type="number"
              min="0"
              placeholder="1.00"
              disabled={!bothSelected}
              value={bothSelected ? inputValue : ''}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>

          {fetchFailed && bothSelected ? (
            <div className="flex items-start gap-3 rounded-md border bg-muted/40 px-4 py-5 text-muted-foreground">
              <WifiOff className="mt-0.5 size-4 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Live rates unavailable</p>
                <p className="mt-0.5">
                  Exchange rates need an internet connection.
                  {typeof navigator !== 'undefined' && !navigator.onLine
                    ? ' You appear to be offline — reconnect and try again.'
                    : ' The rates service could not be reached — try again in a moment.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border bg-muted/40 px-4 py-6 text-center">
              {bothSelected && resultValue > 0 ? (
                <>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight">
                    {resultValue.toFixed(2)} {toCurrency}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {inputValue || 0} {fromCurrency} → {toCurrency}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pick both currencies to see the result.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
  );
}

function CurrencyConverter() {
  return (
    <ToolPage
      icon="💰"
      title="Currency Converter"
      description="Convert between major currencies using live exchange rates."
    >
      <CurrencyPanel />
    </ToolPage>
  );
}

export default CurrencyConverter;
