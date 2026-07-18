import convert from 'convert';
import React, { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
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

const UNITS = [
  { value: 'millimeters', label: 'Millimetres' },
  { value: 'centimeters', label: 'Centimetres' },
  { value: 'inches', label: 'Inches' },
  { value: 'feet', label: 'Feet' },
  { value: 'meters', label: 'Meters' },
  { value: 'yards', label: 'Yards' },
  { value: 'kilometers', label: 'Kilometers' },
  { value: 'miles', label: 'Miles' },
];

export function UnitsPanel() {
  const [fromLength, setFromLength] = useState('');
  const [toLength, setToLength] = useState('');
  const [inputValue, setInputValue] = useState(1);
  const [resultValue, setResultValue] = useState(0);

  const bothSelected = Boolean(fromLength && toLength);

  useEffect(() => {
    if (fromLength && toLength) {
      const n = Number(inputValue);
      setResultValue(convert(Number.isFinite(n) ? n : 0, fromLength).to(toLength));
    }
  }, [fromLength, toLength, inputValue]);

  const swap = () => {
    setFromLength(toLength);
    setToLength(fromLength);
  };

  const unitLabel = (v) => UNITS.find((u) => u.value === v)?.label || v;

  return (
    <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-40 flex-1 gap-1.5">
              <Label htmlFor="fromlength">From</Label>
              <Select value={fromLength} onValueChange={setFromLength}>
                <SelectTrigger id="fromlength" className="w-full">
                  <SelectValue placeholder="Select length" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={swap}
              disabled={!bothSelected}
              aria-label="Swap units"
            >
              <ArrowLeftRight className="size-4" />
            </Button>
            <div className="grid min-w-40 flex-1 gap-1.5">
              <Label htmlFor="tolength">To</Label>
              <Select value={toLength} onValueChange={setToLength}>
                <SelectTrigger id="tolength" className="w-full">
                  <SelectValue placeholder="Select length" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="unit-amount">Amount</Label>
            <Input
              id="unit-amount"
              type="number"
              min="0"
              placeholder="1.00"
              disabled={!bothSelected}
              value={bothSelected ? inputValue : ''}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>

          <div className="rounded-md border bg-muted/40 px-4 py-6 text-center">
            {bothSelected && resultValue > 0 ? (
              <>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {resultValue.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {unitLabel(fromLength)} → {unitLabel(toLength)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pick both units to see the result.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
  );
}

function UnitConverter() {
  return (
    <ToolPage
      icon="📏"
      title="Unit Converter"
      description="Convert lengths between metric and imperial units, instantly and offline."
    >
      <UnitsPanel />
    </ToolPage>
  );
}

export default UnitConverter;
