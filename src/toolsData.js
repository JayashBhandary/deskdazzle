// Single source of truth for the app's tools and primary pages.
// Consumed by the Apps page, the command palette, and the Docs page so the
// catalogue never drifts between them.

export const TOOLS = [
  { path: '/currency-converter', name: 'Currency Converter', icon: '💰', desc: 'Convert between world currencies.', keywords: 'money exchange forex rate' },
  { path: '/budget-tracker', name: 'Budget Tracker', icon: '💳', desc: 'Track income and expenses at a glance.', keywords: 'money finance expense spending' },
  { path: '/unit-converter', name: 'Unit Converter', icon: '📏', desc: 'Convert length, weight, temperature and more.', keywords: 'measure metric imperial length weight' },
  { path: '/to-do-list', name: 'To-Do List', icon: '📝', desc: 'Keep track of tasks, synced to your account.', keywords: 'tasks todo checklist productivity' },
  { path: '/password-generator', name: 'Password Generator', icon: '🔑', desc: 'Generate strong, random passwords.', keywords: 'security random secure credentials' },
  { path: '/text-encryptor', name: 'Text Encryptor', icon: '🔒', desc: 'Encrypt and decrypt text with a passphrase.', keywords: 'security crypto cipher aes secret' },
  { path: '/color-picker', name: 'Color Picker', icon: '🎨', desc: 'Pick colours and grab their hex values.', keywords: 'hex rgb design palette swatch' },
  { path: '/gradient-generator', name: 'Gradient Generator', icon: '🌈', desc: 'Build CSS gradients visually.', keywords: 'css design background colour' },
  { path: '/image-resizer', name: 'Image Resizer', icon: '📐', desc: 'Resize images to exact dimensions.', keywords: 'photo picture scale dimensions' },
  { path: '/markdown-previewer', name: 'Markdown Previewer', icon: '💻', desc: 'Write Markdown and preview it live.', keywords: 'md text editor preview docs' },
  { path: '/qrcode-generator', name: 'QR Code Generator', icon: '🔳', desc: 'Turn text or links into a QR code.', keywords: 'qr barcode link scan' },
  { path: '/calender', name: 'Calendar', icon: '📅', desc: 'Browse a monthly calendar.', keywords: 'date month schedule day' },
  { path: '/image-optimizer', name: 'Image Optimizer', icon: '🖼️', desc: 'Compress images to shrink file size.', keywords: 'photo compress optimise quality' },
  { path: '/translation-tool', name: 'Translation Tool', icon: '💬', desc: 'Translate text between languages.', keywords: 'language translate localisation' },
  { path: '/url-shortner', name: 'URL Shortener', icon: '🔗', desc: 'Shorten long links into tidy ones.', keywords: 'link short tiny redirect' },
  { path: '/text-to-speech', name: 'Text to Speech', icon: '🗣️', desc: 'Read any text out loud.', keywords: 'voice speak audio accessibility tts' },
  { path: '/note-taking', name: 'Note Taking', icon: '💡', desc: 'Jot down quick notes.', keywords: 'notes memo write ideas' },
  { path: '/weather', name: 'Weather', icon: '🌦️', desc: 'Check the current weather.', keywords: 'forecast temperature climate rain' },
  { path: '/calculator', name: 'Calculator', icon: '🧮', desc: 'A simple, fast calculator.', keywords: 'math arithmetic compute numbers' },
  { path: '/recipe-finder', name: 'Recipe Finder', icon: '📜', desc: 'Discover recipes to cook.', keywords: 'food cooking meal ingredients' },
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
    ],
  },
];
