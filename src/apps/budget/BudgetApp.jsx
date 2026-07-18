import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../lib/store/WorkspaceProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const POS = 'text-emerald-600 dark:text-emerald-400'
const NEG = 'text-destructive'

// The Budget app — one component rendered by both the full page and the desktop
// widget. A `@container` root means the layout adapts to whatever width it's
// given: a roomy 3-card summary + labelled controls on the page, and a single
// compact balance bar + tight controls in a small widget, reflowing live as the
// user resizes the window. Shares the same `budget` store as before, so the
// persisted data shape and keys are unchanged.
function BudgetApp() {
  const [entries, setEntries] = useStore('budget', [])
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')

  const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const balance = income - expense

  const add = () => {
    const value = parseFloat(amount)
    if (!desc.trim() || Number.isNaN(value) || value <= 0) return
    setEntries([{ id: Date.now(), desc, amount: value, type }, ...entries])
    setDesc('')
    setAmount('')
    toast.success(`${type === 'income' ? 'Income' : 'Expense'} added`)
  }

  const remove = (id) => {
    setEntries(entries.filter((e) => e.id !== id))
    toast.success('Transaction removed')
  }

  const fmt = (n) => `₹${n.toFixed(2)}`

  const SUMMARY = [
    { label: 'Balance', value: balance, tone: balance >= 0 ? POS : NEG },
    { label: 'Income', value: income, tone: POS },
    { label: 'Expense', value: expense, tone: NEG },
  ]

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      {/* Compact summary: just the balance, shown only in narrow widgets. */}
      <div className="flex shrink-0 items-center justify-between rounded-lg bg-muted px-3 py-2 @sm:hidden">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Balance</span>
        <strong className={`tabular-nums ${balance >= 0 ? POS : NEG}`}>{fmt(balance)}</strong>
      </div>

      {/* Full summary: three cards, once there's room. */}
      <div className="hidden shrink-0 grid-cols-3 gap-3 @sm:grid">
        {SUMMARY.map((s) => (
          <Card key={s.label} className="py-4">
            <CardContent className="px-4 text-center">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <strong className={`text-lg font-semibold tabular-nums ${s.tone}`}>{fmt(s.value)}</strong>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Entry form. */}
      <div className="shrink-0 space-y-2">
        <Input
          value={desc}
          placeholder="Description"
          onChange={(e) => setDesc(e.target.value)}
          aria-label="Transaction description"
        />
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-24 flex-1 @sm:min-w-32"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            placeholder="Amount"
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Transaction amount"
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-28 @sm:w-32" aria-label="Transaction type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={add} aria-label="Add transaction">
            <Plus />
            <span className="hidden @sm:inline">Add</span>
          </Button>
        </div>
      </div>

      {/* Transaction list — fills remaining height and scrolls. */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto @sm:mt-2">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground @sm:py-10">
            No transactions yet. 💸
          </p>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent @sm:gap-3 @sm:border @sm:bg-card @sm:px-3 @sm:py-2 @sm:text-base @sm:hover:bg-card"
            >
              <span className="min-w-0 flex-1 truncate">{e.desc}</span>
              <span className={`font-medium tabular-nums ${e.type === 'income' ? POS : NEG}`}>
                {e.type === 'income' ? '+' : '-'}{fmt(e.amount)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 opacity-60 transition-opacity hover:opacity-100 group-hover:opacity-100 @sm:size-9"
                onClick={() => remove(e.id)}
                aria-label={`Delete ${e.desc}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default BudgetApp
