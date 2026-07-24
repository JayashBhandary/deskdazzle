import { useEffect } from 'react';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

// Registers the service worker in "prompt" mode: when a new build is available,
// show a persistent toast so the user can reload on their own terms instead of
// having the app swap out from under an active session.
export default function PwaUpdatePrompt() {
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        toast('✨ A new version is available', {
          duration: Infinity,
          action: {
            label: 'Update',
            onClick: () => updateSW(true),
          },
        });
      },
    });
  }, []);
  return null;
}
