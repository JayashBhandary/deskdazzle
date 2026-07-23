import React from 'react';
import { Link } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import { Card, CardContent } from '@/components/ui/card';

// Plain-language terms of service. Kept short and honest: Desk Dazzle is a free,
// offline-first workspace, so most "terms" are really just expectations — what
// the app does, what it doesn't promise, and where your data lives (the details
// of which are in the Privacy Policy).
export default function Terms() {
  const updated = 'July 2026';

  const Section = ({ title, children }) => (
    <Card>
      <CardContent className="space-y-2">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );

  return (
    <ToolPage icon="📄" title="Terms of Service">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          These terms cover your use of Desk Dazzle. It&apos;s a free, offline-first
          workspace, so this is intentionally short and plain-spoken. By using the
          app you agree to what&apos;s below.
        </p>

        <Section title="What Desk Dazzle is">
          <p>
            Desk Dazzle is a free, browser-based collection of productivity tools —
            notes, to-dos, a spreadsheet, documents, a calculator and more — that
            runs primarily on your own device and keeps working offline. It is
            provided as-is for personal and everyday use, at no cost.
          </p>
        </Section>

        <Section title="Your account (optional)">
          <p>
            You can use most of Desk Dazzle without an account. If you sign in with
            Google to sync across devices, you&apos;re responsible for keeping access
            to that Google account secure. You may sign out or delete your account
            and synced data at any time from{' '}
            <Link className="text-primary underline underline-offset-4" to="/profile">
              Profile
            </Link>
            .
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5">
            <li>Use the app for anything unlawful, or to store or share illegal content.</li>
            <li>
              Attempt to disrupt, overload, reverse-engineer for abuse, or gain
              unauthorized access to the service or other users&apos; data.
            </li>
            <li>
              Misuse the optional third-party tools (translation, weather, currency)
              in ways that violate those providers&apos; terms.
            </li>
          </ul>
        </Section>

        <Section title="Your content">
          <p>
            Anything you create in Desk Dazzle is yours. We claim no ownership over
            your notes, files or data. Most of it never leaves your device; if you
            sign in, it syncs to a private record only you can read or write. See the{' '}
            <Link className="text-primary underline underline-offset-4" to="/privacy">
              Privacy Policy
            </Link>{' '}
            for exactly what is stored and how to delete it.
          </p>
        </Section>

        <Section title="Availability & changes">
          <p>
            Desk Dazzle is offered on a best-effort basis. Features may be added,
            changed or removed, and the service may occasionally be unavailable. We
            may update these terms from time to time; continued use after a change
            means you accept the updated terms.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            The app is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;,
            without warranties of any kind, express or implied. We don&apos;t
            guarantee it will be error-free, uninterrupted, or fit for any particular
            purpose. Keep your own backups of anything important.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the fullest extent permitted by law, Desk Dazzle and its author are
            not liable for any indirect, incidental or consequential damages, or for
            any loss of data, arising from your use of (or inability to use) the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms? Reach out via the{' '}
            <a
              className="text-primary underline underline-offset-4"
              href="https://github.com/JayashBhandary/deskdazzle/issues"
              target="_blank"
              rel="noreferrer"
            >
              project&apos;s GitHub
            </a>
            .
          </p>
          <p className="pt-1 text-xs">Last updated: {updated}</p>
        </Section>
      </div>
    </ToolPage>
  );
}
