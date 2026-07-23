// Sanitizer for rendered note HTML (markdown → HTML → here → innerHTML).
// Single source of truth so the policy is testable in isolation.
//
// Policy:
//   • keep the wiki-link data-* attributes the linkify pass adds
//   • forbid inline styles / <style> (CSS-injection & data-exfil vector)
//   • force rel="noopener noreferrer" on any link that opens a new tab
// DOMPurify already strips <script>, event handlers and javascript: URLs.

import DOMPurify from 'dompurify';

// DOMPurify hooks are global; register once.
if (!DOMPurify.__ddNotesHook) {
  DOMPurify.__ddNotesHook = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('target')) {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export const NOTE_SANITIZE_CONFIG = {
  // Allow `target` so links can open a new tab; the afterSanitizeAttributes hook
  // above then forces rel="noopener noreferrer" on any such link.
  ADD_ATTR: ['data-entity-id', 'data-entity-type', 'data-note-missing', 'target'],
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['style'],
};

export function sanitizeNoteHtml(raw) {
  return DOMPurify.sanitize(raw ?? '', NOTE_SANITIZE_CONFIG);
}
