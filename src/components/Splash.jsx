import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// A full-screen cover shown on first load until auth + user data have settled,
// so the theme/workspace layout never visibly flips in after the page paints.
// It fades out (then unmounts) once `show` goes false — including the hard
// timeout in App, so it can never hang forever.
function Splash({ show }) {
  const [mounted, setMounted] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return undefined;
    }
    const t = setTimeout(() => setMounted(false), 350); // match fade duration
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden={!show}
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background transition-opacity duration-300',
        show ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-foreground">DƎSK</span>
        <span className="text-sm font-semibold tracking-[0.2em] text-muted-foreground">DAZZLƎ</span>
      </div>
      <span
        className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export default Splash;
