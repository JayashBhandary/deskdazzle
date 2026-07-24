import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getConsent, setConsent } from '@/lib/analyticsConsent';

// Plain-language privacy policy plus a live analytics-consent control so users
// can change their choice at any time (GDPR right to withdraw consent).
export default function Privacy() {
  const [consent, setConsentState] = useState(() => getConsent());

  const update = (value) => {
    setConsent(value);
    setConsentState(value);
  };

  const Section = ({ title, children }) => (
    <Card>
      <CardContent className="space-y-2">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );

  return (
    <ToolPage icon="🔒" title="Privacy Policy">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Desk Dazzle is offline-first: nearly everything you create stays on your
          device. This page explains the few cases where data leaves it, and how to
          delete everything.
        </p>

        <Section title="What stays on your device">
          <p>
            Notes, to-dos, spreadsheets, Drive files, settings and workspace layout
            are stored locally (localStorage + IndexedDB) and processed on-device by
            the built-in WebAssembly engine. They are never sent anywhere unless you
            sign in to sync.
          </p>
        </Section>

        <Section title="If you sign in (optional)">
          <p>
            Signing in with Google syncs your theme, to-dos, projects, desktop
            layout and app data to Firebase Realtime Database under a private record
            keyed to your account — readable and writable only by you. We store a
            minimal profile mirror (display name, avatar URL, last-login time). We do
            not duplicate your email address.
          </p>
        </Section>

        <Section title="Analytics (consent required)">
          <p>
            With your consent we use Google Analytics for Firebase to record
            anonymous usage — page views, sign-in/out, which tools you open, and
            aggregate actions like opening or exporting a file (never the file, its
            name, or its contents). Nothing is collected until you opt in, and you
            can change your choice here at any time:
          </p>
          <p className="pt-1 text-foreground">
            Current choice:{' '}
            <strong>
              {consent === 'granted' ? 'Accepted' : consent === 'denied' ? 'Declined' : 'Not set'}
            </strong>
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant={consent === 'granted' ? 'default' : 'outline'}
              onClick={() => update('granted')}
            >
              Accept analytics
            </Button>
            <Button
              size="sm"
              variant={consent === 'denied' ? 'default' : 'outline'}
              onClick={() => update('denied')}
            >
              Decline analytics
            </Button>
          </div>
          <p className="pt-1 text-xs">
            Declining takes effect immediately for new events; a full reload clears
            any analytics initialized earlier this session.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            Some optional tools call external APIs only when you use them, sending
            just the input needed for that request:
          </p>
          <ul className="list-disc pl-5">
            <li>Translation → api.mymemory.translated.net (sends the text you translate)</li>
            <li>Currency → api.exchangerate-api.com (sends the currency codes)</li>
            <li>Weather → open-meteo.com (sends the location you search)</li>
          </ul>
          <p>Avoid entering sensitive information into these tools.</p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Signing out clears all Desk Dazzle data from the current device. To
            permanently erase your synced cloud data and account, use{' '}
            <Link className="text-primary underline underline-offset-4" to="/profile">
              Profile → Delete account &amp; data
            </Link>
            . This removes your entire cloud record and deletes your account.
          </p>
        </Section>
      </div>
    </ToolPage>
  );
}
