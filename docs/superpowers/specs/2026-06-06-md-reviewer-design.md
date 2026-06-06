# md-reviewer — Design Spec

**Date:** 2026-06-06
**Status:** Approved (design phase)

## 1. Summary

md-reviewer is a document-based macOS desktop application that registers as a handler
for `.md` files. Double-clicking a markdown file in Finder opens it in md-reviewer,
rendered and ready to review. The user reads the rendered markdown, highlights passages,
leaves Google-Docs-style comments in a right-hand rail, and copies all comments out in one
click in a fixed format ready to paste into a coding agent (Claude Code, Cursor, etc.).
Editing the raw markdown source is available on demand.

The primary workflow this serves: a coding agent generates a spec/plan as markdown →
the user opens it in md-reviewer → reads and leaves comments at specific spots → clicks
**Copy Comments** → pastes the result back to the agent → the agent revises the file →
the user re-reviews.

## 2. Goals & Non-Goals

### Goals
- Render markdown (GitHub-Flavored) cleanly, including code blocks with syntax highlighting.
- Let the user edit the raw markdown and save back to disk.
- Let the user highlight rendered text and attach comments shown in a sidebar rail.
- Persist comments across sessions in a sidecar file; re-anchor them on reopen and degrade
  gracefully (mark "stale", never silently drop) when the underlying text has changed.
- One-click copy of all comments in an exact, agent-paste-friendly format.
- Be installable as the default macOS app for `.md` files.

### Non-Goals (YAGNI — explicitly deferred)
- Multi-file project tree, tabs, or workspace browser.
- Project-wide search / find-and-replace.
- Comment threads, replies, or assignees.
- Export to PDF/HTML.
- Themes beyond following the system light/dark setting.
- Real-time collaboration / multi-user.

## 3. Target & Constraints
- **Platform:** macOS first, but built so it can be packaged cross-platform later without a
  rewrite (no Mac-only APIs in the renderer; platform-specific code isolated to the main process).
- **Distribution:** personal use now, shareable to a few people later.
- **Window model:** one window per open document (matches Finder's "open this document" flow).

## 4. Stack
- **Shell:** Electron + electron-builder (packaging & file associations).
- **Build/dev:** electron-vite (fast HMR for the renderer).
- **Language:** TypeScript throughout.
- **UI:** React.
- **Editor:** CodeMirror 6 with markdown language support.
- **Markdown rendering:** `react-markdown` + `remark-gfm` (tables, task lists, strikethrough,
  autolinks) + `rehype-highlight` (code syntax highlighting).
- **Re-anchoring fuzzy match:** `diff-match-patch`.
- **Testing:** Vitest + jsdom.

## 5. Architecture (three layers)

### 5.1 Main process (Node)
- App lifecycle and the native application menu (File/Edit/View with standard items + Copy Comments).
- File I/O: read/write the `.md` file; read/write the sidecar comments file.
- File-association handling: the macOS `open-file` event plus launch `argv` parsing for
  cold-start opens. Routes each opened path to a window (creating one if needed).
- Window management: one `BrowserWindow` per document; track which path each window holds.
- Recent files (native "Open Recent" menu).

### 5.2 Renderer process (React)
The entire UI: top toolbar, rendered preview, on-demand CodeMirror editor pane, comments rail,
toasts. Holds the in-memory document state (source text, parsed comments) for its one file.

### 5.3 Preload bridge
A small typed API exposed via `contextBridge` (context isolation **on**, nodeIntegration **off**):
- `onFileOpened(cb)` — main pushes `{ path, content, comments }` when a file is loaded.
- `saveFile(path, content)` — write markdown back to disk.
- `saveComments(path, commentsDoc)` — write the sidecar (debounced by the renderer).
- `setDirty(isDirty)` — inform main of unsaved-edit state for the close prompt.
- `copyToClipboard(text)` — (or use `navigator.clipboard` directly in the renderer).

## 6. Layout (option C: preview-first, editor on demand)
- **Top bar:** document title (filename + dirty dot) · `✎ Edit` toggle · `Copy Comments` button.
- **Default view:** wide rendered **preview** (left/center) + **comments rail** (right).
- **Edit toggle:** slides a CodeMirror **source pane** in from the left; toggling off returns
  to full-width reading. Editing and reviewing can be done in either state; highlighting/commenting
  happens on the rendered preview.
- Light/dark follows the system.

## 7. Markdown rendering details
- Rendered with `react-markdown` into a single container element (the "preview root") that the
  comment engine owns, so it can walk the DOM's text nodes for anchoring.
- GFM features enabled via `remark-gfm`. Code blocks highlighted via `rehype-highlight`.
- Editing the source re-renders the preview on a short debounce.

## 8. Editor details
- CodeMirror 6, markdown language mode, line wrapping on.
- Source edits flow to the preview (debounced) and mark the document dirty.
- `⌘S` triggers `saveFile`. Closing a window with unsaved edits prompts to save/discard/cancel.

## 9. Comments engine (core, built with TDD)

### 9.1 Anchor model
Each comment is stored as:
```ts
{
  id: string,            // stable unique id
  quote: string,         // exact selected text
  prefix: string,        // ~32 chars of plain text before the selection
  suffix: string,        // ~32 chars of plain text after the selection
  startOffset: number,   // char offset of selection start in the preview's plain text
  endOffset: number,     // char offset of selection end
  commentText: string,
  createdAt: string,     // ISO timestamp
  status: "anchored" | "stale"
}
```
`prefix`/`suffix`/`quote` follow the W3C-annotation "text quote + text position" pattern so a
comment can be re-found even if offsets drift.

### 9.2 Creating a comment
1. On `mouseup` with a non-empty Selection inside the preview root, capture the `Range`.
2. Compute `startOffset`/`endOffset` as character positions in the preview's concatenated
   plain text (walk text nodes in document order).
3. Capture `quote` and the surrounding `prefix`/`suffix`.
4. Open a composer card in the rail, vertically aligned to the selection, focused, with the
   quote shown at top, a comment textarea, and ✓ (save) / ✕ (cancel) buttons.
5. On ✓: persist the comment, convert the live (blue) selection highlight to a saved (yellow)
   one, and settle the card into the rail.

### 9.3 Rendering highlights
- Wrap each anchored range in `<mark data-comment-id="…">` elements, splitting across text-node
  boundaries when a selection spans multiple elements.
- Clicking a highlight focuses and scrolls to its rail card; clicking a card scrolls to and
  flashes its highlight. (Cross-focus both directions.)
- Overlapping highlights are visually layered; clicking resolves to the topmost.

### 9.4 Re-anchoring on reopen (robustness)
For each saved comment, in order:
1. **Exact-offset check:** if the preview plain text at `[startOffset, endOffset)` equals
   `quote`, anchor there.
2. **Fuzzy search:** otherwise search the preview plain text for `quote` (using `diff-match-patch`
   `match_main` seeded near `startOffset`), disambiguating with `prefix`/`suffix`. If a confident
   match is found, anchor there and update the stored offsets.
3. **Stale:** if no confident match, set `status: "stale"`. The card is shown greyed with a
   "⚠ couldn't locate" badge. It remains editable, deletable, and **is still included in Copy**.

No comment is ever silently lost.

### 9.5 Editing / deleting
- Hovering a saved card reveals ✎ edit and 🗑 delete.
- Delete removes the highlight, the card, and the sidecar entry.

## 10. Copy Comments
- The top-bar button assembles all comments (document order by `startOffset`; stale ones
  ordered by their last-known offset) into this exact string and writes it to the clipboard:
```
Comments:
- "<quote>" <-- <commentText>
- "<quote 2>" <-- <commentText 2>
```
- A brief "Copied ✓" toast confirms.
- The assembler is a pure function `formatComments(comments) -> string`, unit-tested independently
  of the UI.

## 11. Persistence (sidecar)
- **Location:** a hidden sibling directory — `<file-dir>/.md-reviewer/<filename>.comments.json`.
  Keeps the `.md` itself clean (embedding was explicitly rejected) and travels with the file's folder.
- **Shape:**
```json
{
  "version": 1,
  "sourceFile": "spec.md",
  "sourceHash": "<hash of the .md contents at last save>",
  "comments": [ /* anchor objects from §9.1 */ ]
}
```
- `sourceHash` lets the app detect whether the `.md` changed since comments were last saved,
  informing re-anchoring confidence.
- Saves are debounced. A corrupt/unparseable sidecar is backed up aside and a fresh one started,
  with a warning toast — never a crash.

## 12. Default-app registration (macOS)
- `electron-builder` `mac.fileAssociations` for `md`, `markdown`, `mdown` generates the
  `CFBundleDocumentTypes` entries in Info.plist, so md-reviewer appears in Finder's "Open With."
- macOS does not allow an app to force itself as the default handler. The one-time user step
  (documented in the README): right-click any `.md` → Get Info → Open With → md-reviewer →
  **Change All**.
- The main process handles the `open-file` event (which can fire before `app.ready`) and also
  parses `process.argv` for cold-start opens.

## 13. Error handling
- File read/write failures surface as a toast; the window does not crash.
- Sidecar parse errors: back up the bad file, start fresh, warn (per §11).
- Unsaved edits prompt on window close.
- Stale comments are preserved and clearly flagged (per §9.4).

## 14. Testing strategy
- **TDD the core:** the offset/anchor computation, the re-anchoring resolver, and
  `formatComments` are pure functions over strings/DOM — tested with Vitest + jsdom.
- File I/O and IPC are kept thin and verified with focused integration tests.
- Manual end-to-end pass: install, set as default, open a file, comment, copy, edit, reopen,
  verify re-anchoring and stale handling.

## 15. Component boundaries (for the implementation plan)
- `main/` — app entry, window manager, file-association/open handling, file I/O, menu.
- `preload/` — typed contextBridge API.
- `renderer/markdown/` — render pipeline (react-markdown config) and the preview root.
- `renderer/anchoring/` — pure anchor compute + re-anchor resolver (heavily tested).
- `renderer/comments/` — comments state, rail UI, composer, highlight rendering, cross-focus.
- `renderer/editor/` — CodeMirror integration and the slide-in pane.
- `renderer/clipboard/` — `formatComments` + copy action.
- `renderer/app/` — toolbar, layout shell, toasts, dirty-state wiring.
