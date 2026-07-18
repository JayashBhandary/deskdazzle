import React from 'react';
import ToolPage from '../components/ToolPage';
import TodoApp from '../apps/todo/TodoApp';

// Thin route host: the Tasks app itself lives in src/apps/todo and is shared
// with the desktop widget. Here we just wrap it in the page shell.
function ToDoList() {
  return (
    <ToolPage
      wide
      icon="📝"
      title="Tasks"
      description="Type naturally — the Rust core parses dates, priorities, tags and recurrence on-device."
    >
      <div className="h-[70vh]">
        <TodoApp />
      </div>
    </ToolPage>
  );
}

export default ToDoList;
