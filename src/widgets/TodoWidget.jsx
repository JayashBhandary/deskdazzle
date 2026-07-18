import React, { useContext, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ThemeContext } from '../App';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Shares the same todos as the full ToDoList. Persistence is handled centrally
// by setTodos (useUserData → Realtime Database) — no per-widget write here.
// Todo objects may carry extra fields (due/priority/tags/recurrence), so
// updates always spread the existing object instead of rebuilding it.
function TodoWidget() {
  const { todos, setTodos } = useContext(ThemeContext);
  const [text, setText] = useState('');
  const list = todos || [];

  const add = () => {
    if (!text.trim()) return;
    setTodos([...list, { text: text.trim(), isDone: false, createdMs: Date.now() }]);
    setText('');
  };

  const toggle = (index) => {
    setTodos(list.map((t, i) => (i === index ? { ...t, isDone: !t.isDone } : t)));
  };

  const remove = (index) => {
    setTodos(list.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex gap-1.5">
        <Input
          className="h-8 min-w-0 flex-1"
          value={text}
          placeholder="Add a task..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button size="icon" className="size-8 shrink-0" onClick={add} aria-label="Add task">
          <Plus />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {list.length === 0
          ? <p className="m-auto text-center text-sm text-muted-foreground">Nothing to do. 🎉</p>
          : list.map((todo, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5 text-sm">
              <Checkbox checked={!!todo.isDone} onCheckedChange={() => toggle(i)} />
              <span className={cn('min-w-0 flex-1 truncate', todo.isDone && 'text-muted-foreground line-through')}>
                {todo.text}
              </span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                title="Remove"
                aria-label="Remove task"
                onClick={() => remove(i)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
      </div>
    </div>
  )
}

export default TodoWidget
