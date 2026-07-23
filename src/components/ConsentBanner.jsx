import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getConsent, setConsent } from '@/lib/analyticsConsent';

// GDPR/CCPA consent gate. Shown only while the analytics choice is undecided
// (getConsent() === null). Analytics never initializes until the user clicks
// "Accept" here (see firebaseConfig + analyticsConsent).
export default function ConsentBanner() {
  const [decided, setDecided] = useState(() => getConsent() !== null);
  const ref = useRef(null);

  // Publish the banner's height as --consent-h so bottom-anchored UI (the
  // desktop dock + zoom controls) can lift above it instead of overlapping.
  // Cleared to 0 whenever the banner isn't shown.
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (decided || !el) {
      root.style.setProperty('--consent-h', '0px');
      return;
    }
    const apply = () => root.style.setProperty('--consent-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--consent-h', '0px');
    };
  }, [decided]);

  if (decided) return null;

  const choose = (value) => {
    setConsent(value);
    setDecided(true);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We'd like to use privacy-respecting analytics to understand which tools
          are used and improve Desk Dazzle. No analytics run until you choose.{' '}
          <Link className="text-primary underline underline-offset-4" to="/privacy">
            Privacy policy
          </Link>.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose('denied')}>
            Decline
          </Button>
          <Button size="sm" onClick={() => choose('granted')}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
