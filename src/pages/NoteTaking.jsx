import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';
import { useLocalStorage } from '../hooks/useLocalStorage';

function NoteTaking() {
  const { theme } = useContext(ThemeContext);
  const [notes, setNotes] = useLocalStorage('deskdazzle.notes', []);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState(null);

  const reset = () => {
    setTitle('');
    setBody('');
    setEditingId(null);
  };

  const save = () => {
    if (!title.trim() && !body.trim()) return;
    if (editingId !== null) {
      setNotes(notes.map((n) => (n.id === editingId ? { ...n, title, body } : n)));
    } else {
      setNotes([{ id: Date.now(), title, body }, ...notes]);
    }
    reset();
  };

  const edit = (note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
  };

  const remove = (id) => {
    setNotes(notes.filter((n) => n.id !== id));
    if (editingId === id) reset();
  };

  return (
    <div className='page'>
      <div className='page__content'>
        <label>💡 NoteTaking</label>
        <div className='content'>
          <div className='tool tool--split'>
            <div className='tool__panel'>
              <input
                className={`tool__input ${theme ? 'dark' : 'light'}`}
                value={title}
                placeholder='Title'
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className={`tool__input tool__editor ${theme ? 'dark' : 'light'}`}
                rows={8}
                value={body}
                placeholder="What's on your mind?"
                onChange={(e) => setBody(e.target.value)}
              />
              <div className='tool__row'>
                <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={save}>
                  {editingId !== null ? '💾 Update' : '➕ Add Note'}
                </button>
                {editingId !== null && (
                  <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={reset}>Cancel</button>
                )}
              </div>
            </div>
            <div className='tool__list'>
              {notes.length === 0
                ? <p>No notes yet. ✍️</p>
                : notes.map((note) => (
                  <div key={note.id} className={`note-card ${theme ? 'dark' : 'light'}`}>
                    <h3>{note.title || 'Untitled'}</h3>
                    <p>{note.body}</p>
                    <div className='tool__row'>
                      <span className='note-card__action' onClick={() => edit(note)}>✏️ Edit</span>
                      <span className='note-card__action' onClick={() => remove(note.id)}>🗑️ Delete</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NoteTaking
