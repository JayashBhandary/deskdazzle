import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { appForFile, requestOpen } from '@/lib/openWith';
import { readFileBytes } from '@/lib/office';
import { logger } from '../lib/logger';

// PWA File Handling: when the installed app is registered as the OS handler for
// .docx/.xlsx/.pptx/.pdf (see `file_handlers` in vite.config.js), double-clicking
// such a file in the OS launches DeskDazzle and delivers the file handles here
// via `window.launchQueue`. We read the bytes on-device and reuse the exact same
// "Open with…" handoff Drive uses (`openWith.js`): stash the bytes on the bus,
// then navigate to the owning app, which imports them on mount. The file never
// leaves the machine — it's decoded by the Rust→WASM office core locally.
//
// Must live inside <BrowserRouter> so it can navigate. The launch action route
// (/workspace) is deliberately NOT one of the four app routes, so navigating to
// the target app always fresh-mounts it and its `consumeOpen` reliably fires —
// no race with the launch-time mount.
export default function FileHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined' || !('launchQueue' in window)) return;

    window.launchQueue.setConsumer(async (launchParams) => {
      const files = launchParams?.files;
      if (!files || files.length === 0) return;

      // The open-with bus carries a single file; open the first and note the rest.
      if (files.length > 1) {
        toast.info(`Opening the first of ${files.length} files.`);
      }

      try {
        const file = await files[0].getFile();
        const target = appForFile(file.name);
        if (!target) {
          toast.error(`Can't open "${file.name}" — unsupported file type.`);
          return;
        }
        const bytes = await readFileBytes(file);
        requestOpen(target.app, file.name, bytes);
        navigate(target.route);
      } catch (err) {
        logger.error('[file-handler] open failed:', err?.message || err);
        toast.error('Could not open the file.');
      }
    });
  }, [navigate]);

  return null;
}
