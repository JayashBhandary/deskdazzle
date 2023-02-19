import React, { useState, useContext, useEffect } from 'react'
import { ThemeContext } from '../App';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

function ToDoList() {
  const { theme, todos, setTodos } = useContext(ThemeContext);
  const [text, setText] = useState("");

  const addTodo = () => {
    const newTodos = [...todos, { text }];
    setTodos(newTodos);
    setText("");
  };

  const markTodo = index => {
    const newTodos = [...todos];
    newTodos[index].isDone = true;
    setTodos(newTodos);
  };
  const unmarkTodo = index => {
    const newTodos = [...todos];
    newTodos[index].isDone = false;
    setTodos(newTodos);
  };

  const removeTodo = index => {
    const newTodos = [...todos];
    newTodos.splice(index, 1);
    setTodos(newTodos);
  };

  useEffect(() => {
    if (auth.currentUser !== null) {
      const docRef = doc(db, "users", auth.currentUser?.uid);
      updateDoc(docRef, {
        todos: todos
      })
    } else {
      console.log("Please sign in")
    }
  }, [todos])

  return (
    <div className='page'>
      <div className='page__content'>

        <label>📝 ToDoList</label>

        <div className='content' style={{ flexDirection: 'column' }}>
          <div className="card">
            <input
              className={theme ? "dark" : "light"}
              value={text}
              onChange={({ target }) => {
                setText(target.value);
              }}
              name="text"
              type="text"
              placeholder="What's on your mind ?"
            />

            <button style={{ color: theme ? "white" : "black" }} className="submit-btn" onClick={addTodo}>Add Todo </button>
          </div>
          {
            todos.length < 1
              ? <label>Feels so empty here. 🧐</label>
              : <div style={{ width: '80%', margin: '12px', padding: '12px', display: 'flex', flexDirection: 'column-reverse' }}>

                {todos?.map((todo, index) => (
                  <div className={`todocard ${todo.isDone === true ? "checked" : ""}`} style={{ display: 'flex' }} key={index}>
                    <input
                      type='checkbox'
                      defaultChecked={todo.isDone}
                      onChange={(e) => { todo.isDone === true ? unmarkTodo(index) : markTodo(index) }}
                    />
                    <p style={{ textDecoration: todo.isDone ? "line-through" : "", fontSize: '28px', marginLeft: '20px' }}>{todo.text}</p>

                  </div>
                ))}
              </div>
          }

        </div>
      </div>
    </div>
  )
}

export default ToDoList