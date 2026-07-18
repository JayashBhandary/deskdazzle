import React from 'react';

// Shared shell for tool pages: consistent width, heading and description.
// All shadcn-migrated pages render inside this.
function ToolPage({ icon, title, description, actions, children, wide = false }) {
  return (
    <div className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-3xl'} px-4 py-8 sm:px-6`}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {icon && <span aria-hidden="true">{icon}</span>}
            <span className="truncate">{title}</span>
          </h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export default ToolPage;
