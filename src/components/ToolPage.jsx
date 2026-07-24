import React from 'react';

// Shared shell for tool pages: consistent width, heading and description.
// All shadcn-migrated pages render inside this. Three layouts:
//
//  • default        — narrow, content-sized reading measure (max-w-3xl).
//                     Privacy, Terms, Settings, Profile, …
//  • `wide`         — full content width, natural height. Content tools whose
//                     height depends on their content (Design, Images,
//                     Converters, Vault, QR).
//  • `fill`         — full width AND full viewport height. Real full-screen
//                     apps (Excel, Word, PowerPoint, PDF, Drive, Notes, Tasks,
//                     Clock): the page fills the space below the sticky header
//                     (h-14 = 3.5rem) as a flex column so the app region
//                     (flex-1) claims all remaining height, with the app
//                     scrolling internally instead of the page.
function ToolPage({ icon, title, description, actions, children, wide = false, fill = false }) {
  const layout = fill
    ? 'flex h-[calc(100dvh-3.5rem)] max-w-none flex-col'
    : wide
      ? 'max-w-none'
      : 'max-w-3xl';
  return (
    <div className={`mx-auto w-full px-4 py-8 sm:px-6 ${layout}`}>
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
      {fill ? <div className="min-h-0 flex-1">{children}</div> : children}
    </div>
  );
}

export default ToolPage;
