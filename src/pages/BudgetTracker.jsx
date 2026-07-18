import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { useStore } from '../lib/store/WorkspaceProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const POS = 'text-emerald-600 dark:text-emerald-400';
const NEG = 'text-destructive';

function BudgetTracker() {
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
    toast.success(`${type === 'income' ? 'Income' : 'Expense'} added`);
  };

  const remove = (id) => {
    setEntries(entries.filter((e) => e.id !== id));
    toast.success('Transaction removed');
  };

  const fmt = (n) => `₹${n.toFixed(2)}`;

  const SUMMARY = [
    { label: 'Balance', value: balance, tone: balance >= 0 ? POS : NEG },
    { label: 'Income', value: income, tone: POS },
    { label: 'Expense', value: expense, tone: NEG },
  ];

  return (
    <ToolPage
      icon='💳'
      title='Budget Tracker'
      description='Track income and expenses at a glance.'
    >
      <div className='mb-4 grid grid-cols-3 gap-3'>
        {SUMMARY.map((s) => (
          <Card key={s.label} className='py-4'>
            <CardContent className='px-4 text-center'>
              <span className='block text-xs uppercase tracking-wide text-muted-foreground'>{s.label}</span>
              <strong className={`text-lg font-semibold tabular-nums ${s.tone}`}>{fmt(s.value)}</strong>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='space-y-2'>
        <Input
          value={desc}
          placeholder='Description'
          onChange={(e) => setDesc(e.target.value)}
          aria-label='Transaction description'
        />
        <div className='flex flex-wrap gap-2'>
          <Input
            className='min-w-32 flex-1'
            type='number'
            min='0'
            step='0.01'
            value={amount}
            placeholder='Amount'
            onChange={(e) => setAmount(e.target.value)}
            aria-label='Transaction amount'
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className='w-32' aria-label='Transaction type'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='expense'>Expense</SelectItem>
              <SelectItem value='income'>Income</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={add}>
            <Plus /> Add
          </Button>
        </div>
      </div>

      <div className='mt-6 space-y-2'>
        {entries.length === 0 ? (
          <Card>
            <CardContent className='py-10 text-center text-muted-foreground'>
              No transactions yet. 💸
            </CardContent>
          </Card>
        ) : (
          entries.map((e) => (
            <div key={e.id} className='group flex items-center gap-3 rounded-md border bg-card px-3 py-2'>
              <span className='min-w-0 flex-1 truncate'>{e.desc}</span>
              <span className={`font-medium tabular-nums ${e.type === 'income' ? POS : NEG}`}>
                {e.type === 'income' ? '+' : '-'}{fmt(e.amount)}
              </span>
              <Button
                variant='ghost'
                size='icon'
                className='opacity-60 transition-opacity hover:opacity-100 group-hover:opacity-100'
                onClick={() => remove(e.id)}
                aria-label={`Delete “${e.desc}”`}
              >
                <Trash2 className='size-4' />
              </Button>
            </div>
          ))
        )}
      </div>
    </ToolPage>
  )
}

export default BudgetTracker
