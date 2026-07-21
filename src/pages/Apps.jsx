import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { TOOLS, CATEGORIES } from '../toolsData';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// One-line hint per category folder.
const CATEGORY_HINT = {
  Office: 'Create, edit and save Word & Excel documents.',
  Create: 'Make images, colours and codes.',
  Convert: 'Reshape data, units and money.',
  Study: 'Learn, revise and stay focused.',
  Plan: 'Organise tasks, goals and money.',
  Utilities: 'Everyday on-device helpers.',
  Web: 'Handy tools that need a connection.',
};

function ToolCard({ tool }) {
  return (
    <Link
      to={tool.path}
      className='group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    >
      <Card className='h-full gap-0 py-5 transition-colors group-hover:border-primary/40 group-hover:bg-accent/50'>
        <CardContent className='flex flex-col gap-1.5 px-5'>
          <span className='text-3xl' aria-hidden='true'>{tool.icon}</span>
          <span className='font-medium'>{tool.name}</span>
          <span className='text-sm text-muted-foreground'>{tool.desc}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function Apps() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((t) =>
      (t.name + ' ' + t.desc + ' ' + (t.keywords || '')).toLowerCase().includes(q)
    );
  }, [query]);

  // Group the (filtered) tools into their category folders, preserving order.
  const groups = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        tools: filtered.filter((t) => t.category === category),
      })).filter((g) => g.tools.length > 0),
    [filtered]
  );

  return (
    <div className='mx-auto w-full max-w-6xl px-4 py-8 sm:px-6'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>📱 Apps</h1>
          <p className='mt-1 text-sm text-muted-foreground'>Every Desk Dazzle tool, organised into folders.</p>
        </div>
        <div className='relative w-full sm:w-72'>
          <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' aria-hidden='true' />
          <Input
            type='search'
            className='pl-8'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search tools…'
            aria-label='Search tools'
          />
        </div>
      </header>

      {groups.map(({ category, tools }) => (
        <section key={category} className='mb-10'>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold tracking-tight'>{category}</h2>
            <p className='text-sm text-muted-foreground'>{CATEGORY_HINT[category]}</p>
          </div>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {tools.map((tool) => (
              <ToolCard key={tool.path} tool={tool} />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className='mt-10 text-center text-muted-foreground'>No tools match “{query}”.</p>
      )}
    </div>
  )
}

export default Apps
