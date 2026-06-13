import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Shares the same budget store as the full BudgetTracker tool.
function BudgetWidget() {
  const { theme } = useContext(ThemeContext);
  const [entries, setEntries] = useLocalStorage('deskdazzle.budget', []);
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
    <div className='widget'>
      <div className='budgetw__balance'>
        <span>Balance</span>
        <strong className={balance >= 0 ? 'pos' : 'neg'}>₹{balance.toFixed(2)}</strong>
      </div>
      <div className='widget__addrow'>
        <input className={`widget__input ${theme ? 'dark' : 'light'}`} value={desc} placeholder='Desc' onChange={(e) => setDesc(e.target.value)} />
        <input className={`widget__input ${theme ? 'dark' : 'light'}`} style={{ maxWidth: '70px' }} type='number' value={amount} placeholder='₹' onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className='widget__addrow'>
        <select className={`widget__input ${theme ? 'dark' : 'light'}`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value='expense'>Expense</option>
          <option value='income'>Income</option>
        </select>
        <button className='widget__addbtn' onClick={add}>+</button>
      </div>
      <div className='widget__scroll'>
        {entries.length === 0
          ? <p className='widget__empty'>No transactions.</p>
          : entries.map((e) => (
            <div key={e.id} className='widget__item'>
              <span style={{ flex: 1 }}>{e.desc}</span>
              <span className={e.type === 'income' ? 'pos' : 'neg'}>{e.type === 'income' ? '+' : '-'}₹{e.amount.toFixed(2)}</span>
              <span className='widget__x' onClick={() => remove(e.id)}>×</span>
            </div>
          ))}
      </div>
    </div>
  )
}

export default BudgetWidget
