import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';

// Shares the same todos as the full ToDoList. Persistence is handled centrally
// by setTodos (useUserData → Realtime Database) — no per-widget write here.
function TodoWidget() {
  const { theme, todos, setTodos } = useContext(ThemeContext);
  const [text, setText] = useState('');

  const add = () => {
    if (!text.trim()) return;
    setTodos([...todos, { text, isDone: false }]);
    setText('');
  };

  const toggle = (index) => {
    setTodos(todos.map((t, i) => (i === index ? { ...t, isDone: !t.isDone } : t)));
  };

  const remove = (index) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <div className='widget'>
      <div className='widget__addrow'>
        <input
          className={`widget__input ${theme ? 'dark' : 'light'}`}
          value={text}
          placeholder='Add a task...'
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className='widget__addbtn' onClick={add}>+</button>
      </div>
      <div className='widget__scroll'>
        {todos.length === 0
          ? <p className='widget__empty'>Nothing to do. 🎉</p>
          : todos.map((todo, i) => (
            <div key={i} className='widget__item'>
              <input type='checkbox' checked={!!todo.isDone} onChange={() => toggle(i)} />
              <span style={{ textDecoration: todo.isDone ? 'line-through' : 'none', opacity: todo.isDone ? 0.6 : 1, flex: 1 }}>{todo.text}</span>
              <span className='widget__x' onClick={() => remove(i)}>×</span>
            </div>
          ))}
      </div>
    </div>
  )
}

export default TodoWidget
