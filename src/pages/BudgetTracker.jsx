import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';
import { useLocalStorage } from '../hooks/useLocalStorage';

function BudgetTracker() {
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

  const fmt = (n) => `₹${n.toFixed(2)}`;

  return (
    <div className='page'>
      <div className='page__content'>
        <label>💳 BudgetTracker</label>
        <div className='content'>
          <div className='tool tool--split'>
            <div className='tool__panel'>
              <div className={`budget__summary ${theme ? 'dark' : 'light'}`}>
                <div><span>Balance</span><strong className={balance >= 0 ? 'pos' : 'neg'}>{fmt(balance)}</strong></div>
                <div><span>Income</span><strong className='pos'>{fmt(income)}</strong></div>
                <div><span>Expense</span><strong className='neg'>{fmt(expense)}</strong></div>
              </div>
              <input
                className={`tool__input ${theme ? 'dark' : 'light'}`}
                value={desc}
                placeholder='Description'
                onChange={(e) => setDesc(e.target.value)}
              />
              <div className='tool__row'>
                <input
                  className={`tool__num ${theme ? 'dark' : 'light'}`}
                  type='number'
                  min='0'
                  step='0.01'
                  value={amount}
                  placeholder='Amount'
                  onChange={(e) => setAmount(e.target.value)}
                />
                <select className={`tool__num ${theme ? 'dark' : 'light'}`} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value='expense'>Expense</option>
                  <option value='income'>Income</option>
                </select>
                <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={add}>➕ Add</button>
              </div>
            </div>
            <div className='tool__list'>
              {entries.length === 0
                ? <p>No transactions yet. 💸</p>
                : entries.map((e) => (
                  <div key={e.id} className={`budget__row ${theme ? 'dark' : 'light'}`}>
                    <span>{e.desc}</span>
                    <span className={e.type === 'income' ? 'pos' : 'neg'}>{e.type === 'income' ? '+' : '-'}{fmt(e.amount)}</span>
                    <span className='note-card__action' onClick={() => remove(e.id)}>🗑️</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BudgetTracker
