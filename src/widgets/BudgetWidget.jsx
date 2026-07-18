import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../lib/store/WorkspaceProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const POS = 'text-emerald-600 dark:text-emerald-400';
const NEG = 'text-destructive';

// Shares the same budget store as the full BudgetTracker tool.
function BudgetWidget() {
  const [entries, setEntries] = useStore('budget', []);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');

  const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const balance = income - expense;

  const add = () => {
    const value = parseFloat(amount);
    if (!desc.trim() || Number.isNaN(value) || value <= 0) return;
    setEntries([{ id: Date.now(), desc, amount: value, type }, ...entries]);
    setDesc('');
    setAmount('');
  };

  const remove = (id) => setEntries(entries.filter((e) => e.id !== id));

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Balance</span>
        <strong className={`tabular-nums ${balance >= 0 ? POS : NEG}`}>₹{balance.toFixed(2)}</strong>
      </div>
      <div className="flex gap-1.5">
        <Input className="h-8 min-w-0 flex-1" value={desc} placeholder="Desc" onChange={(e) => setDesc(e.target.value)} />
        <Input className="h-8 w-16" type="number" value={amount} placeholder="₹" onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="flex gap-1.5">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 flex-1" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
        <Button size="icon" className="size-8 shrink-0" onClick={add} aria-label="Add transaction">
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No transactions.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="group flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
              <span className="min-w-0 flex-1 truncate">{e.desc}</span>
              <span className={`tabular-nums ${e.type === 'income' ? POS : NEG}`}>
                {e.type === 'income' ? '+' : '-'}₹{e.amount.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                aria-label={`Remove ${e.desc}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default BudgetWidget
