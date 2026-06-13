import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Shares the same notes store as the full NoteTaking tool.
function NotesWidget() {
  const { theme } = useContext(ThemeContext);
  const [notes, setNotes] = useLocalStorage('deskdazzle.notes', []);
  const [body, setBody] = useState('');

  const add = () => {
    if (!body.trim()) return;
    const title = body.trim().split('\n')[0].slice(0, 40);
    setNotes([{ id: Date.now(), title, body }, ...notes]);
    setBody('');
  };

  const remove = (id) => setNotes(notes.filter((n) => n.id !== id));

  return (
    <div className='widget'>
      <div className='widget__addrow'>
        <textarea
          className={`widget__input ${theme ? 'dark' : 'light'}`}
          rows={2}
          value={body}
          placeholder='Quick note...'
          onChange={(e) => setBody(e.target.value)}
        />
        <button className='widget__addbtn' onClick={add}>+</button>
      </div>
      <div className='widget__scroll'>
        {notes.length === 0
          ? <p className='widget__empty'>No notes yet. ✍️</p>
          : notes.map((note) => (
            <div key={note.id} className='widget__note'>
              <p>{note.title || 'Untitled'}</p>
              <span className='widget__x' onClick={() => remove(note.id)}>×</span>
            </div>
          ))}
      </div>
    </div>
  )
}

export default NotesWidget
