// Central logger — a single choke point for app logging so debug/info noise is
// stripped from production builds while warnings/errors always surface (and can
// later be routed to a remote sink or redacted in one place).
//
// Prod is detected via Vite's `import.meta.env.PROD`.

const isProd =
  typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.PROD : false;

export const logger = {
  debug: (...args) => { if (!isProd) console.debug(...args); },
  info: (...args) => { if (!isProd) console.info(...args); },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
