import React, { useContext, useEffect, useState } from 'react'
import { ThemeContext } from '../App';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// Shares the same todos as the full ToDoList (Firestore-backed via context).
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

  useEffect(() => {
    if (auth.currentUser) {
      updateDoc(doc(db, 'users', auth.currentUser.uid), { todos }).catch(() => {});
    }
  }, [todos]);

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
