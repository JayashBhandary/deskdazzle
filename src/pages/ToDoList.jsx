import React from 'react';
import ToolPage from '../components/ToolPage';
import TodoApp from '../apps/todo/TodoApp';

// Thin route host: the Tasks app itself lives in src/apps/todo and is shared
// with the desktop widget. Here we just wrap it in the page shell.
function ToDoList() {
  return (
    <ToolPage
      fill
      icon="📝"
      title="Tasks"
      description="Type naturally — dates, times, priorities, tags and recurrence are parsed on-device."
    >
      <div className="h-full">
        <TodoApp />
      </div>
    </ToolPage>
  );
}

export default ToDoList;
