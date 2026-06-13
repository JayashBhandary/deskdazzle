# DeskDazzle — Improvement Suggestions

Ideas to evolve DeskDazzle into a polished, windowed productivity desktop.
Grouped by theme, with the highest-leverage items flagged.

> Status legend: 🔴 high impact · 🟡 medium · 🟢 nice-to-have

---

## 🔝 Highest leverage (do these first)

| # | Idea | Why | Effort |
|---|------|-----|--------|
| 1 | **Code-split the bundle** | Initial JS is ~1.1 MB in one chunk (mostly Firebase, color picker, html2canvas). Wrap routes/widgets in `React.lazy()` + `Suspense` and lazy-load Firebase. Can cut initial load 60–70%. | 🔴 Med |
| 2 | **Custom wallpaper via your own tools** | Let users set the desktop background to a solid color (ColorPicker) or gradient (GradientGenerator). Gives those existing tools a real purpose inside the product. | 🔴 Med |
| 3 | **Per-widget error boundaries** | Today, one widget throwing (e.g. a bad API response) can blank the whole desktop. Wrap each window body so a crash shows "⚠️ widget error – reload" instead. | 🔴 Low |
| 4 | **Replace `alert()` with toasts** | Several tools use `alert()` for "Copied!" / errors, which feels dated. A small toast system modernizes the whole app. | 🔴 Low |

---

## 🖥️ Desktop / workspace power features

- 🔴 **Window snapping** — drag a window to a screen edge → snaps to half/quarter. Expected behavior for a "desktop."
- 🟡 **Multiple workspaces** — tabs like *Work* / *Personal*, each with its own layout (extend the existing Firestore layout schema).
- 🟡 **Multiple instances of a widget** — currently limited to one per type.
- 🟡 **Right-click desktop → Add widget** context menu.
- 🟡 **Drag a tool from the Apps grid onto the desktop** to open it as a window.
- 🔴 **Command palette (⌘/Ctrl-K)** — launch any tool/widget and search notes/todos. Big for a productivity app.
- 🟢 **Saved layout presets** — e.g. "Focus", "Finance dashboard".
- 🟢 **Keyboard shortcuts** for window management (close, cycle, minimize all).

---

## 🧩 New productivity widgets

- 🔴 **Pomodoro / focus timer** — with a PWA notification when the session ends.
- 🟡 **Sticky notes** placed directly on the wallpaper (not inside a window).
- 🟡 **Quick links / bookmarks** widget.
- 🟢 **Habit tracker** — pairs naturally with the calendar.
- 🟡 **"Today" summary** — todos due, balance, and weather in one glanceable card.

---

## 🔄 Data, sync & security

- 🔴 **Sync Notes & Budget to Firestore** — currently localStorage-only, while todos already sync. Make them follow the user across devices for consistency.
- 🟡 **Export / import all data as JSON** — backup and portability.
- 🔴 **Fix TextEncryptor** — it uses a *hardcoded shared key baked into the bundle*, so it isn't real encryption and is misleading. Switch to a user-entered passphrase.
- 🔴 **Verify Firestore security rules** — none are in the repo; confirm they restrict each document to its owning user (not left open).

---

## ✨ Polish & PWA

- 🟡 **First-run onboarding** — a short intro to the desktop + dock.
- 🟡 **Web Share Target** — register the PWA to receive shared text/URLs straight into Notes or the URL shortener.
- 🟢 **App shortcuts in the manifest** — deep-link to specific tools (long-press the installed icon).
- 🔴 **Better mobile experience** — windowing is weak on phones; a stacked-card "widget feed" view would feel far better than maximized windows.
- 🟡 **Tests** — Vitest is already wired but unused. Add coverage for the calculator logic, `useLocalStorage`, and the desktop layout hook.

---

## Suggested roadmap

1. **Harden + speed up:** code-split (#1) + error boundaries (#3) + toasts (#4).
2. **First real desktop feature:** custom wallpaper via ColorPicker/GradientGenerator (#2).
3. **Power UX:** command palette + window snapping.
4. **Depth:** Firestore sync for all tools, Pomodoro widget, multiple workspaces.

---

*Generated as a planning reference — not all items are committed work.*
