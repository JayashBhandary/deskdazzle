// Single source of truth for the app's tools and primary pages.
// Consumed by the Apps page, the command palette, and the Docs page so the
// catalogue never drifts between them.

// Category order for the Apps grid (web-OS "folders"). Every tool declares a
// `category` that matches one of these.
export const CATEGORIES = ['Office', 'Create', 'Convert', 'Study', 'Plan', 'Utilities', 'Web'];

// Post-consolidation catalogue: several tools were merged into tabbed apps
// (Images, Converters, Design, Vault). Old paths still work — App.jsx redirects
// them to the merged app + the right ?tab=.
export const TOOLS = [
  // --- Office (document suite, powered by the office WASM core) ---
  { path: '/word', name: 'Word', icon: '📄', desc: 'Write documents — save as .docx or export PDF, on-device.', keywords: 'word document docx pdf writer processor letter report headings tables office export', category: 'Office' },
  { path: '/excel', name: 'Excel', icon: '📊', desc: 'Spreadsheets — open .xlsx/.xls/.ods/.csv, save .xlsx/.csv or export PDF.', keywords: 'excel spreadsheet xlsx xls xlsb ods csv pdf sheet cells formula rows columns table office export', category: 'Office' },
  { path: '/powerpoint', name: 'PowerPoint', icon: '📽️', desc: 'Slide decks — save as .pptx or export PDF, on-device.', keywords: 'powerpoint slides deck presentation pptx pdf bullets layout notes office export slideshow', category: 'Office' },
  { path: '/pdf', name: 'PDF', icon: '📕', desc: 'Create PDFs from text, merge files, reorder/rotate/delete/extract pages.', keywords: 'pdf create compose merge combine split extract organize reorder rotate delete pages office', category: 'Office' },

  // --- Create ---
  { path: '/images', name: 'Images', icon: '🖼️', desc: 'Resize, optimize and batch-convert images — all on-device.', keywords: 'image photo resize optimise compress batch zip png jpeg webp bulk', category: 'Create' },
  { path: '/design', name: 'Design', icon: '🎨', desc: 'Pick colours and build CSS gradients.', keywords: 'colour color hex rgb palette swatch gradient css background design', category: 'Create' },
  { path: '/qrcode-generator', name: 'QR Code Generator', icon: '🔳', desc: 'Turn text or links into a QR code.', keywords: 'qr barcode link scan', category: 'Create' },

  // --- Convert ---
  { path: '/converters', name: 'Converters', icon: '🔁', desc: 'Data formats, units and currencies — data & units run on-device.', keywords: 'convert csv json yaml base64 url markdown encode decode unit length weight currency money exchange rate wasm', category: 'Convert' },

  // --- Study ---
  { path: '/note-taking', name: 'Notes', icon: '💡', desc: 'Markdown notes with [[wiki links]], backlinks and instant search.', keywords: 'notes memo write ideas markdown wiki links backlinks knowledge preview', category: 'Study' },
  { path: '/flashcards', name: 'Flashcards', icon: '🃏', desc: 'Spaced-repetition study cards (great for med school & exams).', keywords: 'study spaced repetition anki srs medicine exam memorize learn', category: 'Study' },

  // --- Plan ---
  { path: '/today', name: 'Today', icon: '🌅', desc: 'One agenda across everything due today and this week.', keywords: 'today agenda dashboard due overdue upcoming schedule tasks milestones', category: 'Plan' },
  { path: '/to-do-list', name: 'Tasks', icon: '📝', desc: 'Projects, subtasks and a kanban board — with natural-language quick-add.', keywords: 'tasks todo checklist productivity kanban board projects subtasks', category: 'Plan' },
  { path: '/roadmap', name: 'Roadmap Planner', icon: '🗺️', desc: 'Plan goals as milestones and steps — startup, research or exam prep.', keywords: 'roadmap milestones goals plan startup research project timeline', category: 'Plan' },
  { path: '/calender', name: 'Calendar', icon: '📅', desc: 'Browse a monthly calendar.', keywords: 'date month schedule day', category: 'Plan' },
  { path: '/budget-tracker', name: 'Budget Tracker', icon: '💳', desc: 'Track income and expenses at a glance.', keywords: 'money finance expense spending budget', category: 'Plan' },

  // --- Utilities ---
  { path: '/drive', name: 'Drive', icon: '🗂️', desc: 'Keep your files on-device — upload, folder, download. Isolated per workspace.', keywords: 'drive files storage upload folder documents images pdf binary local disk filesystem', category: 'Utilities' },
  { path: '/clock', name: 'Clock', icon: '⏰', desc: 'World clock, alarms, stopwatch, timers and focus sessions.', keywords: 'clock time world timezone city alarm stopwatch lap timer countdown pomodoro focus study break', category: 'Utilities' },
  { path: '/vault', name: 'Vault', icon: '🔐', desc: 'Generate strong passwords and encrypt text — 100% on-device.', keywords: 'security password generator random encrypt decrypt crypto cipher aes secret vault', category: 'Utilities' },
  { path: '/calculator', name: 'Calculator', icon: '🧮', desc: 'A simple, fast calculator.', keywords: 'math arithmetic compute numbers', category: 'Utilities' },
  { path: '/text-to-speech', name: 'Text to Speech', icon: '🗣️', desc: 'Read any text out loud.', keywords: 'voice speak audio accessibility tts', category: 'Utilities' },

  // --- Web (need a connection) ---
  { path: '/weather', name: 'Weather', icon: '🌦️', desc: 'Check the current weather.', keywords: 'forecast temperature climate rain', category: 'Web' },
  { path: '/translation-tool', name: 'Translation Tool', icon: '💬', desc: 'Translate text between languages.', keywords: 'language translate localisation', category: 'Web' },
];

// Primary destinations that live in the top navigation / command palette.
export const PAGES = [
  { path: '/', name: 'Workspace', icon: '🖥️', desc: 'Your draggable widget desktop.', keywords: 'home desktop dashboard widgets' },
  { path: '/apps', name: 'Apps', icon: '📱', desc: 'Browse every tool.', keywords: 'tools catalogue all' },
  { path: '/docs', name: 'Docs', icon: '🔧', desc: 'Guides, features and shortcuts.', keywords: 'documentation help guide manual shortcuts' },
  { path: '/profile', name: 'Profile', icon: '👤', desc: 'Your account and saved data.', keywords: 'account user login sign in' },
  { path: '/donate', name: 'Donate', icon: '🙌', desc: 'Support the project.', keywords: 'support tip give contribute' },
];

// Navigation links shown in the header and mobile drawer.
export const NAV_LINKS = [
  { path: '/', label: 'Workspace', icon: '🖥️' },
  { path: '/apps', label: 'Apps', icon: '📱' },
  { path: '/docs', label: 'Docs', icon: '🔧' },
];

// Everything searchable from the command palette.
export const SEARCHABLE = [...PAGES, ...TOOLS];

// Keyboard shortcuts, grouped for the Docs page and the in-app help overlay.
export const SHORTCUT_GROUPS = [
  {
    title: 'Global',
    items: [
      { keys: ['⌘', 'K'], alt: ['Ctrl', 'K'], desc: 'Open the command palette to search & jump to any tool' },
      { keys: ['G', 'then', 'H'], desc: 'Go to the Workspace' },
      { keys: ['G', 'then', 'A'], desc: 'Go to Apps' },
      { keys: ['G', 'then', 'D'], desc: 'Go to the Docs' },
      { keys: ['T'], desc: 'Toggle light / dark theme' },
      { keys: ['⌘', 'Shift', 'D'], alt: ['Ctrl', 'Shift', 'D'], desc: 'Toggle the collapsible dock' },
      { keys: ['⌘', 'Shift', 'H'], alt: ['Ctrl', 'Shift', 'H'], desc: 'Toggle the collapsible header' },
      { keys: ['Shift', 'B'], desc: 'Collapse / expand the sidebar (Word, Excel, Notes, Slides)' },
      { keys: ['Shift', '?'], desc: 'Show this keyboard-shortcut overlay' },
      { keys: ['Esc'], desc: 'Close the palette, overlay or menu' },
    ],
  },
  {
    title: 'Command palette',
    items: [
      { keys: ['↑', '↓'], desc: 'Move between results' },
      { keys: ['Enter'], desc: 'Open the highlighted result' },
      { keys: ['Esc'], desc: 'Close the palette' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { keys: ['1', '–', '8'], desc: 'Open the matching widget (Clock, To-Do, Notes, …)' },
      { keys: ['W'], desc: 'Switch to the next workspace (Space)' },
      { keys: ['Shift', 'W'], desc: 'Switch to the previous workspace' },
      { keys: ['⌘', '+'], alt: ['Ctrl', '+'], desc: 'Zoom in the canvas' },
      { keys: ['⌘', '−'], alt: ['Ctrl', '−'], desc: 'Zoom out the canvas' },
      { keys: ['⌘', '0'], alt: ['Ctrl', '0'], desc: 'Zoom to fit all open widgets' },
    ],
  },
];
