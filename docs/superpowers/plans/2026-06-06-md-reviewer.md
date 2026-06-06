# md-reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a document-based macOS markdown reviewer (Electron + React) that renders markdown, lets the user highlight rendered text and leave sidebar comments persisted in a sidecar file, and copies all comments out in an agent-paste-friendly format.

**Architecture:** Electron with three layers — a Node **main** process (window management, file I/O, `.md` file-association handling), a React **renderer** (preview, on-demand editor, comments rail, toolbar), and a typed **preload** bridge between them. The risky core — converting between DOM selections and character offsets, re-anchoring saved comments to possibly-changed text, and formatting the copy output — is a set of pure functions built test-first with Vitest.

**Tech Stack:** Electron, electron-vite, electron-builder, React 18 + TypeScript, CodeMirror 6, react-markdown + remark-gfm + rehype-highlight, diff-match-patch, Vitest + jsdom.

---

## File Structure

```
md-reviewer/
  package.json                      # deps, scripts, electron-builder config
  electron.vite.config.ts           # main/preload/renderer build config
  tsconfig.json / tsconfig.node.json
  vitest.config.ts                  # jsdom default test env
  index.html                        # renderer entry
  src/
    main/
      index.ts                      # app entry, open-file handling, IPC
      windowManager.ts              # create/track one window per document
      fileService.ts                # read/write the .md file
      commentsStore.ts              # sidecar read/write, hashing, corrupt backup
    preload/
      index.ts                      # contextBridge: window.api
    renderer/
      main.tsx                      # React root
      App.tsx                       # layout shell + wiring
      types.ts                      # ReviewComment, CommentsDoc, CommentStatus
      anchoring/
        extractText.ts              # DOM text-node walk -> {text, segments}
        offsets.ts                  # Range <-> char offsets
        anchor.ts                   # buildAnchorFields, resolveOffsets
        highlight.ts                # wrap offset ranges in <mark>
        *.test.ts
      comments/
        commentsState.ts            # pure reducer + factory (tested)
        useComments.ts              # useReducer wrapper
        CommentsRail.tsx
        CommentCard.tsx
        Composer.tsx
      clipboard/
        formatComments.ts           # copy format (tested)
        formatComments.test.ts
      markdown/
        Preview.tsx                 # react-markdown render into preview root
      editor/
        EditorPane.tsx              # CodeMirror slide-in pane
      ui/
        Toolbar.tsx
        Toast.tsx
      global.d.ts                   # window.api type
  build/                            # electron-builder resources (icons)
  README.md
```

**Shared type contract (defined once in Task 3, used everywhere):**

```ts
export type CommentStatus = 'anchored' | 'stale'

export interface ReviewComment {
  id: string
  quote: string
  prefix: string
  suffix: string
  startOffset: number
  endOffset: number
  commentText: string
  createdAt: string
  status: CommentStatus
}

export interface CommentsDoc {
  version: 1
  sourceFile: string
  sourceHash: string
  comments: ReviewComment[]
}
```

---

## Task 1: Project scaffold (Electron + React + TS via electron-vite)

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main.tsx`, `src/renderer/App.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "md-reviewer",
  "version": "0.1.0",
  "description": "Markdown reviewer with comments",
  "main": "./out/main/index.js",
  "author": "Tanay Naik",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "dist": "electron-vite build && electron-builder --mac"
  },
  "dependencies": {
    "@codemirror/lang-markdown": "^6.2.5",
    "@codemirror/state": "^6.4.1",
    "@codemirror/view": "^6.28.0",
    "codemirror": "^6.0.1",
    "diff-match-patch": "^1.0.5",
    "highlight.js": "^11.9.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.1",
    "rehype-highlight": "^7.0.0",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.1.0",
    "@testing-library/react": "^16.0.0",
    "@types/diff-match-patch": "^1.0.36",
    "@types/node": "^20.12.12",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3",
    "electron-vite": "^2.3.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `electron.vite.config.ts`**

```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    resolve: { alias: { '@renderer': resolve('src/renderer') } },
    plugins: [react()]
  }
})
```

- [ ] **Step 3: Create `tsconfig.node.json` and `tsconfig.json`**

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "electron.vite.config.ts"]
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@renderer/*": ["src/renderer/*"] }
  },
  "include": ["src/renderer/**/*", "src/preload/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `index.html`** (renderer entry)

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" />
    <title>md-reviewer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create minimal `src/main/index.ts`**

```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 6: Create minimal `src/preload/index.ts`**

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {})
```

- [ ] **Step 7: Create `src/renderer/main.tsx` and `src/renderer/App.tsx`**

`src/renderer/main.tsx`:
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/App.tsx`:
```tsx
export default function App() {
  return <h1 style={{ fontFamily: 'system-ui', padding: 24 }}>md-reviewer</h1>
}
```

- [ ] **Step 8: Install and run**

Run: `npm install`
Run: `npm run dev`
Expected: an Electron window opens showing "md-reviewer". Close it with `Cmd+Q`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react + typescript app"
```

---

## Task 2: Test harness (Vitest + jsdom)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/renderer/anchoring/sanity.test.ts` (temporary smoke test, deleted in Step 5)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
})
```

- [ ] **Step 2: Write a smoke test** `src/renderer/anchoring/sanity.test.ts`

```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs in jsdom with a document', () => {
    const div = document.createElement('div')
    div.textContent = 'hello'
    expect(div.textContent).toBe('hello')
  })
})
```

- [ ] **Step 3: Run it**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 4: Delete the smoke test**

```bash
rm src/renderer/anchoring/sanity.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add vitest + jsdom test harness"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/renderer/types.ts`

- [ ] **Step 1: Create `src/renderer/types.ts`**

```ts
export type CommentStatus = 'anchored' | 'stale'

export interface ReviewComment {
  id: string
  quote: string
  prefix: string
  suffix: string
  startOffset: number
  endOffset: number
  commentText: string
  createdAt: string
  status: CommentStatus
}

export interface CommentsDoc {
  version: 1
  sourceFile: string
  sourceHash: string
  comments: ReviewComment[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/types.ts
git commit -m "feat: shared comment/anchor types"
```

---

## Task 4: extractText — DOM text walk to {text, segments}

This is the foundation for all offset math: it flattens the preview DOM into one plain-text string plus a map from character ranges back to the text nodes that produced them. Text node contents are concatenated with **no separators**, so offset math between Ranges and the string is exact. Both comment creation and re-anchoring use this same function, so it is internally consistent.

**Files:**
- Create: `src/renderer/anchoring/extractText.ts`
- Test: `src/renderer/anchoring/extractText.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { extractText } from './extractText'

function root(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('extractText', () => {
  it('concatenates text nodes in document order', () => {
    const { text } = extractText(root('<p>Hello </p><p>world</p>'))
    expect(text).toBe('Hello world')
  })

  it('maps each segment to its text node and global offsets', () => {
    const r = root('<p>ab</p><p>cd</p>')
    const { text, segments } = extractText(r)
    expect(text).toBe('abcd')
    expect(segments).toHaveLength(2)
    expect(segments[0].start).toBe(0)
    expect(segments[0].end).toBe(2)
    expect(segments[0].node.data).toBe('ab')
    expect(segments[1].start).toBe(2)
    expect(segments[1].end).toBe(4)
    expect(segments[1].node.data).toBe('cd')
  })

  it('skips script/style content', () => {
    const { text } = extractText(root('<p>keep</p><style>.x{}</style><script>1</script>'))
    expect(text).toBe('keep')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- extractText`
Expected: FAIL ("Failed to resolve import './extractText'").

- [ ] **Step 3: Implement `extractText`**

```ts
export interface TextSegment {
  node: Text
  start: number
  end: number
}

export interface ExtractedText {
  text: string
  segments: TextSegment[]
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])

export function extractText(root: Node): ExtractedText {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (parent && SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })

  const segments: TextSegment[] = []
  let text = ''
  let current = walker.nextNode() as Text | null
  while (current) {
    const value = current.data
    const start = text.length
    segments.push({ node: current, start, end: start + value.length })
    text += value
    current = walker.nextNode() as Text | null
  }
  return { text, segments }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- extractText`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/anchoring/extractText.ts src/renderer/anchoring/extractText.test.ts
git commit -m "feat: extractText flattens preview DOM to text + segment map"
```

---

## Task 5: offsets — Range <-> char offsets

**Files:**
- Create: `src/renderer/anchoring/offsets.ts`
- Test: `src/renderer/anchoring/offsets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { extractText } from './extractText'
import { rangeToOffsets, offsetsToRange } from './offsets'

function root(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('rangeToOffsets', () => {
  it('converts a single-node range to global offsets', () => {
    const r = root('<p>Hello world</p>')
    const textNode = r.querySelector('p')!.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 6)
    range.setEnd(textNode, 11)
    const ext = extractText(r)
    expect(rangeToOffsets(ext, range)).toEqual({ startOffset: 6, endOffset: 11 })
  })

  it('converts a range spanning two nodes', () => {
    const r = root('<p>abc</p><p>def</p>')
    const ext = extractText(r)
    const range = document.createRange()
    range.setStart(ext.segments[0].node, 2) // global 2
    range.setEnd(ext.segments[1].node, 2)   // global 5
    expect(rangeToOffsets(ext, range)).toEqual({ startOffset: 2, endOffset: 5 })
  })
})

describe('offsetsToRange', () => {
  it('round-trips offsets back to a range whose text matches', () => {
    const r = root('<p>Hello world</p>')
    const ext = extractText(r)
    const range = offsetsToRange(ext, 6, 11)!
    expect(range.toString()).toBe('world')
  })

  it('round-trips a multi-node range', () => {
    const r = root('<p>abc</p><p>def</p>')
    const ext = extractText(r)
    const range = offsetsToRange(ext, 2, 5)!
    expect(range.toString()).toBe('cde')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- offsets`
Expected: FAIL ("Failed to resolve import './offsets'").

- [ ] **Step 3: Implement `offsets.ts`**

```ts
import type { ExtractedText, TextSegment } from './extractText'

function segmentForGlobal(segments: TextSegment[], offset: number): { node: Text; local: number } | null {
  for (const seg of segments) {
    if (offset >= seg.start && offset <= seg.end) {
      return { node: seg.node, local: offset - seg.start }
    }
  }
  return null
}

function globalForNode(segments: TextSegment[], node: Node, local: number): number | null {
  for (const seg of segments) {
    if (seg.node === node) return seg.start + local
  }
  return null
}

export function rangeToOffsets(
  ext: ExtractedText,
  range: Range
): { startOffset: number; endOffset: number } | null {
  const start = globalForNode(ext.segments, range.startContainer, range.startOffset)
  const end = globalForNode(ext.segments, range.endContainer, range.endOffset)
  if (start === null || end === null) return null
  return start <= end
    ? { startOffset: start, endOffset: end }
    : { startOffset: end, endOffset: start }
}

export function offsetsToRange(
  ext: ExtractedText,
  startOffset: number,
  endOffset: number
): Range | null {
  const startPos = segmentForGlobal(ext.segments, startOffset)
  const endPos = segmentForGlobal(ext.segments, endOffset)
  if (!startPos || !endPos) return null
  const range = document.createRange()
  range.setStart(startPos.node, startPos.local)
  range.setEnd(endPos.node, endPos.local)
  return range
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- offsets`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/anchoring/offsets.ts src/renderer/anchoring/offsets.test.ts
git commit -m "feat: convert between DOM ranges and char offsets"
```

---

## Task 6: anchor — buildAnchorFields

Given the flattened text and a selection's offsets, capture the quote plus up to 32 chars of surrounding context (used later to disambiguate when re-anchoring).

**Files:**
- Create: `src/renderer/anchoring/anchor.ts`
- Test: `src/renderer/anchoring/anchor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildAnchorFields } from './anchor'

describe('buildAnchorFields', () => {
  it('captures quote, prefix, and suffix', () => {
    const text = 'The quick brown fox jumps over the lazy dog'
    const start = text.indexOf('brown fox')
    const end = start + 'brown fox'.length
    const fields = buildAnchorFields(text, start, end, 5)
    expect(fields.quote).toBe('brown fox')
    expect(fields.prefix).toBe('uick ')
    expect(fields.suffix).toBe(' jump')
  })

  it('clamps context at the start and end of the document', () => {
    const text = 'abcde'
    const fields = buildAnchorFields(text, 0, 2, 10)
    expect(fields.quote).toBe('ab')
    expect(fields.prefix).toBe('')
    expect(fields.suffix).toBe('cde')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- anchor`
Expected: FAIL ("buildAnchorFields is not a function" / import error).

- [ ] **Step 3: Implement `buildAnchorFields` in `anchor.ts`**

```ts
export const CONTEXT_LEN = 32

export function buildAnchorFields(
  text: string,
  startOffset: number,
  endOffset: number,
  contextLen = CONTEXT_LEN
): { quote: string; prefix: string; suffix: string } {
  return {
    quote: text.slice(startOffset, endOffset),
    prefix: text.slice(Math.max(0, startOffset - contextLen), startOffset),
    suffix: text.slice(endOffset, endOffset + contextLen)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- anchor`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/anchoring/anchor.ts src/renderer/anchoring/anchor.test.ts
git commit -m "feat: buildAnchorFields captures quote + context"
```

---

## Task 7: anchor — resolveOffsets (re-anchoring, the robustness core)

Re-locate a saved comment in (possibly changed) text: try the stored offset, then an exact search disambiguated by context, then a fuzzy search; if nothing confident is found, return `stale`.

**Files:**
- Modify: `src/renderer/anchoring/anchor.ts`
- Test: `src/renderer/anchoring/resolveOffsets.test.ts`

- [ ] **Step 1: Write the failing test** `src/renderer/anchoring/resolveOffsets.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { resolveOffsets } from './anchor'

const base = { commentText: '', id: '', createdAt: '' }

describe('resolveOffsets', () => {
  it('anchors exactly when text is unchanged', () => {
    const text = 'The quick brown fox'
    const r = resolveOffsets(text, { ...base, quote: 'brown', prefix: 'quick ', suffix: ' fox', startOffset: 10, endOffset: 15, status: 'anchored' })
    expect(r).toEqual({ startOffset: 10, endOffset: 15, status: 'anchored' })
  })

  it('re-anchors when text shifted (content inserted before)', () => {
    const text = 'INTRO. The quick brown fox'
    const r = resolveOffsets(text, { ...base, quote: 'brown', prefix: 'quick ', suffix: ' fox', startOffset: 10, endOffset: 15, status: 'anchored' })
    expect(text.slice(r.startOffset, r.endOffset)).toBe('brown')
    expect(r.status).toBe('anchored')
  })

  it('uses context to disambiguate duplicate quotes', () => {
    const text = 'set x to value. later set y to value.'
    // we want the SECOND "value" (after "y to ")
    const second = text.lastIndexOf('value')
    const r = resolveOffsets(text, { ...base, quote: 'value', prefix: 'y to ', suffix: '.', startOffset: second, endOffset: second + 5, status: 'anchored' })
    expect(r.startOffset).toBe(second)
    expect(r.status).toBe('anchored')
  })

  it('marks stale when the quote is gone', () => {
    const text = 'completely different content now'
    const r = resolveOffsets(text, { ...base, quote: 'brown fox', prefix: 'quick ', suffix: ' jumps', startOffset: 10, endOffset: 19, status: 'anchored' })
    expect(r.status).toBe('stale')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- resolveOffsets`
Expected: FAIL ("resolveOffsets is not a function").

- [ ] **Step 3: Add `resolveOffsets` (and helpers) to `anchor.ts`**

Append to `src/renderer/anchoring/anchor.ts`:
```ts
import DiffMatchPatch from 'diff-match-patch'
import type { CommentStatus } from '../types'

interface ResolveInput {
  quote: string
  prefix: string
  suffix: string
  startOffset: number
  endOffset: number
}

function commonPrefixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function commonSuffixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}

function findExact(text: string, anchor: ResolveInput): { startOffset: number; endOffset: number } | null {
  const { quote, prefix, suffix, startOffset } = anchor
  if (!quote) return null
  const candidates: number[] = []
  let i = text.indexOf(quote)
  while (i !== -1) {
    candidates.push(i)
    i = text.indexOf(quote, i + 1)
  }
  if (candidates.length === 0) return null

  let best = candidates[0]
  let bestScore = -Infinity
  for (const c of candidates) {
    const before = text.slice(Math.max(0, c - prefix.length), c)
    const after = text.slice(c + quote.length, c + quote.length + suffix.length)
    const score =
      commonSuffixLen(before, prefix) +
      commonPrefixLen(after, suffix) -
      Math.abs(c - startOffset) / 100000
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return { startOffset: best, endOffset: best + quote.length }
}

export function resolveOffsets(
  text: string,
  anchor: ResolveInput
): { startOffset: number; endOffset: number; status: CommentStatus } {
  const { quote, startOffset, endOffset } = anchor

  // 1. Exact at the stored offset.
  if (quote.length > 0 && text.slice(startOffset, endOffset) === quote) {
    return { startOffset, endOffset, status: 'anchored' }
  }

  // 2. Exact elsewhere, disambiguated by context + nearest position.
  const exact = findExact(text, anchor)
  if (exact) return { ...exact, status: 'anchored' }

  // 3. Fuzzy match near the stored location.
  if (quote.length > 0) {
    const dmp = new DiffMatchPatch()
    dmp.Match_Threshold = 0.3
    dmp.Match_Distance = 1000
    const loc = dmp.match_main(text, quote, Math.min(startOffset, Math.max(0, text.length - 1)))
    if (loc !== -1) {
      return { startOffset: loc, endOffset: loc + quote.length, status: 'anchored' }
    }
  }

  // 4. Lost.
  return { startOffset, endOffset, status: 'stale' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- resolveOffsets`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/anchoring/anchor.ts src/renderer/anchoring/resolveOffsets.test.ts
git commit -m "feat: resolveOffsets re-anchors comments and flags stale ones"
```

---

## Task 8: formatComments — the copy output

**Files:**
- Create: `src/renderer/clipboard/formatComments.ts`
- Test: `src/renderer/clipboard/formatComments.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { formatComments } from './formatComments'
import type { ReviewComment } from '../types'

function c(partial: Partial<ReviewComment>): ReviewComment {
  return {
    id: 'x', quote: '', prefix: '', suffix: '',
    startOffset: 0, endOffset: 0, commentText: '',
    createdAt: '', status: 'anchored', ...partial
  }
}

describe('formatComments', () => {
  it('formats comments in document order', () => {
    const out = formatComments([
      c({ quote: '15 minutes of inactivity', commentText: 'Make this configurable?', startOffset: 50 }),
      c({ quote: 'expire', commentText: 'Why expire at all?', startOffset: 10 })
    ])
    expect(out).toBe(
      'Comments:\n' +
      '- "expire" <-- Why expire at all?\n' +
      '- "15 minutes of inactivity" <-- Make this configurable?'
    )
  })

  it('collapses internal newlines in quote and comment to single spaces', () => {
    const out = formatComments([c({ quote: 'line one\nline two', commentText: 'has\nnewline', startOffset: 0 })])
    expect(out).toBe('Comments:\n- "line one line two" <-- has newline')
  })

  it('returns a header-only string when there are no comments', () => {
    expect(formatComments([])).toBe('Comments:')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- formatComments`
Expected: FAIL (import error).

- [ ] **Step 3: Implement `formatComments`**

```ts
import type { ReviewComment } from '../types'

function clean(s: string): string {
  return s.replace(/\s*\n\s*/g, ' ').trim()
}

export function formatComments(comments: ReviewComment[]): string {
  const sorted = [...comments].sort((a, b) => a.startOffset - b.startOffset)
  const lines = sorted.map((c) => `- "${clean(c.quote)}" <-- ${clean(c.commentText)}`)
  return ['Comments:', ...lines].join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- formatComments`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/clipboard/formatComments.ts src/renderer/clipboard/formatComments.test.ts
git commit -m "feat: formatComments builds the agent-paste copy output"
```

---

## Task 9: highlight — wrap offset ranges in <mark>

Applies highlights by wrapping the text at each comment's offsets in `<mark data-comment-id>`. Re-extracts text per comment so structural splits never corrupt offsets (text content is unchanged by wrapping).

**Files:**
- Create: `src/renderer/anchoring/highlight.ts`
- Test: `src/renderer/anchoring/highlight.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { applyHighlights, clearHighlights } from './highlight'

function root(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('applyHighlights', () => {
  it('wraps a single-paragraph range in one mark', () => {
    const r = root('<p>Hello world</p>')
    applyHighlights(r, [{ id: 'c1', startOffset: 6, endOffset: 11, status: 'anchored' }])
    const marks = r.querySelectorAll('mark[data-comment-id="c1"]')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('world')
  })

  it('wraps a cross-paragraph range in one mark per text node', () => {
    const r = root('<p>abc</p><p>def</p>')
    applyHighlights(r, [{ id: 'c2', startOffset: 2, endOffset: 5, status: 'anchored' }])
    const marks = Array.from(r.querySelectorAll('mark[data-comment-id="c2"]'))
    expect(marks.map((m) => m.textContent)).toEqual(['c', 'de'])
  })

  it('adds a stale class for stale comments', () => {
    const r = root('<p>Hello world</p>')
    applyHighlights(r, [{ id: 'c3', startOffset: 0, endOffset: 5, status: 'stale' }])
    expect(r.querySelector('mark[data-comment-id="c3"]')!.classList.contains('mdr-stale')).toBe(true)
  })

  it('clearHighlights unwraps marks and restores text', () => {
    const r = root('<p>Hello world</p>')
    applyHighlights(r, [{ id: 'c4', startOffset: 6, endOffset: 11, status: 'anchored' }])
    clearHighlights(r)
    expect(r.querySelectorAll('mark').length).toBe(0)
    expect(r.textContent).toBe('Hello world')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- highlight`
Expected: FAIL (import error).

- [ ] **Step 3: Implement `highlight.ts`**

```ts
import { extractText } from './extractText'
import type { CommentStatus } from '../types'

export interface HighlightRange {
  id: string
  startOffset: number
  endOffset: number
  status: CommentStatus
}

export function clearHighlights(root: HTMLElement): void {
  const marks = Array.from(root.querySelectorAll('mark[data-comment-id]'))
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }
}

function wrapRange(root: HTMLElement, range: HighlightRange): void {
  const { segments } = extractText(root)
  for (const seg of segments) {
    const overlapStart = Math.max(range.startOffset, seg.start)
    const overlapEnd = Math.min(range.endOffset, seg.end)
    if (overlapStart >= overlapEnd) continue

    let node = seg.node
    const localStart = overlapStart - seg.start
    const localEnd = overlapEnd - seg.start
    if (localStart > 0) node = node.splitText(localStart)
    if (localEnd - localStart < node.data.length) node.splitText(localEnd - localStart)

    const mark = document.createElement('mark')
    mark.setAttribute('data-comment-id', range.id)
    mark.className = 'mdr-highlight' + (range.status === 'stale' ? ' mdr-stale' : '')
    node.parentNode!.insertBefore(mark, node)
    mark.appendChild(node)
  }
}

export function applyHighlights(root: HTMLElement, ranges: HighlightRange[]): void {
  clearHighlights(root)
  for (const range of ranges) {
    wrapRange(root, range)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- highlight`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/anchoring/highlight.ts src/renderer/anchoring/highlight.test.ts
git commit -m "feat: applyHighlights wraps anchored ranges in mark elements"
```

---

## Task 10: commentsState — pure reducer + factory

**Files:**
- Create: `src/renderer/comments/commentsState.ts`
- Test: `src/renderer/comments/commentsState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { commentsReducer, makeComment } from './commentsState'
import type { ReviewComment } from '../types'

const sample = (over: Partial<ReviewComment> = {}): ReviewComment => ({
  id: 'a', quote: 'q', prefix: '', suffix: '', startOffset: 0, endOffset: 1,
  commentText: 'hi', createdAt: 't', status: 'anchored', ...over
})

describe('makeComment', () => {
  it('assembles a comment from fields + injected id/time', () => {
    const c = makeComment({
      id: 'id1', createdAt: '2026-01-01',
      fields: { quote: 'fox', prefix: 'the ', suffix: ' runs' },
      startOffset: 4, endOffset: 7, commentText: 'why?'
    })
    expect(c).toEqual({
      id: 'id1', quote: 'fox', prefix: 'the ', suffix: ' runs',
      startOffset: 4, endOffset: 7, commentText: 'why?',
      createdAt: '2026-01-01', status: 'anchored'
    })
  })
})

describe('commentsReducer', () => {
  it('load replaces all comments', () => {
    const next = commentsReducer([sample()], { type: 'load', comments: [sample({ id: 'b' })] })
    expect(next.map((c) => c.id)).toEqual(['b'])
  })
  it('add appends', () => {
    const next = commentsReducer([sample()], { type: 'add', comment: sample({ id: 'b' }) })
    expect(next.map((c) => c.id)).toEqual(['a', 'b'])
  })
  it('updateText changes only the matching comment', () => {
    const next = commentsReducer([sample()], { type: 'updateText', id: 'a', commentText: 'new' })
    expect(next[0].commentText).toBe('new')
  })
  it('delete removes the matching comment', () => {
    const next = commentsReducer([sample(), sample({ id: 'b' })], { type: 'delete', id: 'a' })
    expect(next.map((c) => c.id)).toEqual(['b'])
  })
  it('resolve updates offsets and status by id', () => {
    const next = commentsReducer([sample()], {
      type: 'resolve',
      resolved: [{ id: 'a', startOffset: 9, endOffset: 12, status: 'stale' }]
    })
    expect(next[0]).toMatchObject({ startOffset: 9, endOffset: 12, status: 'stale' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- commentsState`
Expected: FAIL (import error).

- [ ] **Step 3: Implement `commentsState.ts`**

```ts
import type { CommentStatus, ReviewComment } from '../types'

export type CommentsAction =
  | { type: 'load'; comments: ReviewComment[] }
  | { type: 'add'; comment: ReviewComment }
  | { type: 'updateText'; id: string; commentText: string }
  | { type: 'delete'; id: string }
  | { type: 'resolve'; resolved: { id: string; startOffset: number; endOffset: number; status: CommentStatus }[] }

export function commentsReducer(state: ReviewComment[], action: CommentsAction): ReviewComment[] {
  switch (action.type) {
    case 'load':
      return action.comments
    case 'add':
      return [...state, action.comment]
    case 'updateText':
      return state.map((c) => (c.id === action.id ? { ...c, commentText: action.commentText } : c))
    case 'delete':
      return state.filter((c) => c.id !== action.id)
    case 'resolve': {
      const byId = new Map(action.resolved.map((r) => [r.id, r]))
      return state.map((c) => {
        const r = byId.get(c.id)
        return r ? { ...c, startOffset: r.startOffset, endOffset: r.endOffset, status: r.status } : c
      })
    }
    default:
      return state
  }
}

export function makeComment(params: {
  id: string
  createdAt: string
  fields: { quote: string; prefix: string; suffix: string }
  startOffset: number
  endOffset: number
  commentText: string
}): ReviewComment {
  return {
    id: params.id,
    quote: params.fields.quote,
    prefix: params.fields.prefix,
    suffix: params.fields.suffix,
    startOffset: params.startOffset,
    endOffset: params.endOffset,
    commentText: params.commentText,
    createdAt: params.createdAt,
    status: 'anchored'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- commentsState`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/comments/commentsState.ts src/renderer/comments/commentsState.test.ts
git commit -m "feat: pure comments reducer + comment factory"
```

---

## Task 11: Main process — fileService + commentsStore

**Files:**
- Create: `src/main/fileService.ts`
- Create: `src/main/commentsStore.ts`
- Test: `src/main/commentsStore.test.ts`

- [ ] **Step 1: Write the failing test** `src/main/commentsStore.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { sidecarPath, readComments, writeComments, hashContent } from './commentsStore'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mdr-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('commentsStore', () => {
  it('computes a sidecar path in a hidden .md-reviewer dir', () => {
    const p = sidecarPath(join(dir, 'spec.md'))
    expect(p).toBe(join(dir, '.md-reviewer', 'spec.md.comments.json'))
  })

  it('returns a fresh doc when no sidecar exists', () => {
    const doc = readComments(join(dir, 'spec.md'))
    expect(doc).toEqual({ version: 1, sourceFile: 'spec.md', sourceHash: '', comments: [] })
  })

  it('round-trips a written doc', () => {
    const file = join(dir, 'spec.md')
    writeComments(file, { version: 1, sourceFile: 'spec.md', sourceHash: 'abc', comments: [] })
    expect(readComments(file).sourceHash).toBe('abc')
  })

  it('backs up a corrupt sidecar and returns a fresh doc', () => {
    const file = join(dir, 'spec.md')
    const p = sidecarPath(file)
    writeComments(file, { version: 1, sourceFile: 'spec.md', sourceHash: '', comments: [] })
    writeFileSync(p, '{ not valid json')
    const doc = readComments(file)
    expect(doc.comments).toEqual([])
    const backups = readdirSync(join(dir, '.md-reviewer')).filter((f) => f.includes('.corrupt'))
    expect(backups.length).toBe(1)
  })

  it('hashContent is stable and content-sensitive', () => {
    expect(hashContent('a')).toBe(hashContent('a'))
    expect(hashContent('a')).not.toBe(hashContent('b'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- commentsStore`
Expected: FAIL (import error).

- [ ] **Step 3: Implement `commentsStore.ts`**

```ts
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { CommentsDoc } from '../renderer/types'

export function sidecarPath(filePath: string): string {
  return join(dirname(filePath), '.md-reviewer', `${basename(filePath)}.comments.json`)
}

export function hashContent(content: string): string {
  return createHash('sha1').update(content).digest('hex')
}

function freshDoc(filePath: string): CommentsDoc {
  return { version: 1, sourceFile: basename(filePath), sourceHash: '', comments: [] }
}

export function readComments(filePath: string): CommentsDoc {
  const p = sidecarPath(filePath)
  if (!existsSync(p)) return freshDoc(filePath)
  const raw = readFileSync(p, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as CommentsDoc
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.comments)) throw new Error('bad shape')
    return parsed
  } catch {
    const backup = `${p}.corrupt-${Date.now()}`
    renameSync(p, backup)
    return freshDoc(filePath)
  }
}

export function writeComments(filePath: string, doc: CommentsDoc): void {
  const p = sidecarPath(filePath)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(doc, null, 2), 'utf-8')
}
```

Note: `Date.now()` in the corrupt-backup name is production code (not a test); the test only asserts a `.corrupt` file exists.

- [ ] **Step 4: Implement `fileService.ts`**

```ts
import { readFileSync, writeFileSync } from 'fs'

export function readMarkdown(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

export function writeMarkdown(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf-8')
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- commentsStore`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/main/commentsStore.ts src/main/fileService.ts src/main/commentsStore.test.ts
git commit -m "feat: sidecar comments store + markdown file service"
```

---

## Task 12: Main process — open-file handling, windows, IPC, preload

**Files:**
- Create: `src/main/windowManager.ts`
- Modify: `src/main/index.ts` (replace contents from Task 1)
- Modify: `src/preload/index.ts` (replace contents from Task 1)
- Create: `src/renderer/global.d.ts`

- [ ] **Step 1: Implement `src/main/windowManager.ts`**

```ts
import { BrowserWindow } from 'electron'
import { join } from 'path'

export interface DocWindow {
  win: BrowserWindow
  filePath: string | null
}

const windows = new Set<DocWindow>()

export function createDocWindow(): DocWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  const doc: DocWindow = { win, filePath: null }
  windows.add(doc)
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => windows.delete(doc))

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return doc
}

export function docForWebContents(id: number): DocWindow | undefined {
  for (const doc of windows) {
    if (doc.win.webContents.id === id) return doc
  }
  return undefined
}

export function hasWindows(): boolean {
  return windows.size > 0
}
```

- [ ] **Step 2: Replace `src/main/index.ts`**

```ts
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { readMarkdown, writeMarkdown } from './fileService'
import { hashContent, readComments, writeComments } from './commentsStore'
import { createDocWindow, docForWebContents, hasWindows, type DocWindow } from './windowManager'
import type { CommentsDoc } from '../renderer/types'

const pendingPaths: string[] = []

function sendFile(doc: DocWindow, filePath: string): void {
  doc.filePath = filePath
  const content = readMarkdown(filePath)
  const commentsDoc = readComments(filePath)
  const deliver = () => doc.win.webContents.send('file-opened', { path: filePath, content, comments: commentsDoc.comments })
  if (doc.win.webContents.isLoading()) {
    doc.win.webContents.once('did-finish-load', deliver)
  } else {
    deliver()
  }
}

function openPath(filePath: string): void {
  const doc = createDocWindow()
  sendFile(doc, filePath)
}

// macOS: fired when a file is opened via Finder / `open`. Can fire before ready.
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (app.isReady()) openPath(filePath)
  else pendingPaths.push(filePath)
})

function registerIpc(): void {
  ipcMain.handle('save-file', (event, content: string) => {
    const doc = docForWebContents(event.sender.id)
    if (doc?.filePath) writeMarkdown(doc.filePath, content)
  })

  ipcMain.handle('save-comments', (event, comments: CommentsDoc['comments'], sourceContent: string) => {
    const doc = docForWebContents(event.sender.id)
    if (!doc?.filePath) return
    const docToWrite: CommentsDoc = {
      version: 1,
      sourceFile: doc.filePath.split('/').pop() || '',
      sourceHash: hashContent(sourceContent),
      comments
    }
    writeComments(doc.filePath, docToWrite)
  })

  ipcMain.on('set-dirty', (event, dirty: boolean) => {
    const doc = docForWebContents(event.sender.id)
    if (doc) doc.win.setDocumentEdited(dirty)
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu())
  registerIpc()
  if (pendingPaths.length > 0) {
    pendingPaths.forEach(openPath)
    pendingPaths.length = 0
  } else {
    createDocWindow() // empty window if launched without a file
  }
  app.on('activate', () => {
    if (!hasWindows()) createDocWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [{ label: 'md-reviewer', click: () => shell.openExternal('https://github.com') }]
    }
  ])
}
```

- [ ] **Step 3: Replace `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { ReviewComment } from '../renderer/types'

export interface FileOpenedPayload {
  path: string
  content: string
  comments: ReviewComment[]
}

const api = {
  onFileOpened(cb: (payload: FileOpenedPayload) => void): void {
    ipcRenderer.on('file-opened', (_e, payload: FileOpenedPayload) => cb(payload))
  },
  saveFile(content: string): Promise<void> {
    return ipcRenderer.invoke('save-file', content)
  },
  saveComments(comments: ReviewComment[], sourceContent: string): Promise<void> {
    return ipcRenderer.invoke('save-comments', comments, sourceContent)
  },
  setDirty(dirty: boolean): void {
    ipcRenderer.send('set-dirty', dirty)
  }
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
```

- [ ] **Step 4: Create `src/renderer/global.d.ts`**

```ts
import type { Api } from '../preload/index'

declare global {
  interface Window {
    api: Api
  }
}

export {}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`
Then, in a second terminal, with the app running: `open -a Electron path/to/any.md` is not reliable in dev. Instead temporarily verify via the empty window (it should still open without errors). Full file-open is verified end-to-end in Task 18 after packaging. For now confirm: `npm run dev` opens an empty window and the devtools console shows no preload errors, and `window.api` exists (type in devtools console: `window.api`).
Expected: `window.api` prints an object with `onFileOpened`, `saveFile`, `saveComments`, `setDirty`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: main-process open-file routing, IPC, and typed preload bridge"
```

---

## Task 13: Preview component (react-markdown)

**Files:**
- Create: `src/renderer/markdown/Preview.tsx`

- [ ] **Step 1: Implement `Preview.tsx`**

```tsx
import { forwardRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

interface PreviewProps {
  source: string
  onMouseUp: () => void
}

export const Preview = forwardRef<HTMLDivElement, PreviewProps>(function Preview(
  { source, onMouseUp },
  ref
) {
  return (
    <div className="mdr-preview" ref={ref} onMouseUp={onMouseUp}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {source}
      </ReactMarkdown>
    </div>
  )
})
```

- [ ] **Step 2: Manual verification (deferred)**

This renders once wired into `App` in Task 17. No standalone test — react-markdown output is exercised by the integration pass.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/markdown/Preview.tsx
git commit -m "feat: markdown preview component with gfm + syntax highlighting"
```

---

## Task 14: Comment UI components (Composer, CommentCard, CommentsRail)

**Files:**
- Create: `src/renderer/comments/Composer.tsx`
- Create: `src/renderer/comments/CommentCard.tsx`
- Create: `src/renderer/comments/CommentsRail.tsx`

- [ ] **Step 1: Implement `Composer.tsx`**

```tsx
import { useState } from 'react'

interface ComposerProps {
  quote: string
  onSave: (text: string) => void
  onCancel: () => void
}

export function Composer({ quote, onSave, onCancel }: ComposerProps) {
  const [text, setText] = useState('')
  return (
    <div className="mdr-card mdr-card-active">
      <div className="mdr-quote">"{quote}"</div>
      <textarea
        className="mdr-composer"
        autoFocus
        placeholder="Add a comment…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(text)
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="mdr-card-actions">
        <button className="mdr-btn" onClick={onCancel} title="Cancel">✕</button>
        <button className="mdr-btn mdr-btn-ok" onClick={() => onSave(text)} disabled={!text.trim()} title="Save">✓</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `CommentCard.tsx`**

```tsx
import { useState } from 'react'
import type { ReviewComment } from '../types'

interface CommentCardProps {
  comment: ReviewComment
  active: boolean
  onFocus: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
}

export function CommentCard({ comment, active, onFocus, onUpdate, onDelete }: CommentCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.commentText)

  return (
    <div
      className={`mdr-card${active ? ' mdr-card-active' : ''}${comment.status === 'stale' ? ' mdr-card-stale' : ''}`}
      onClick={() => onFocus(comment.id)}
    >
      <div className="mdr-quote">
        {comment.status === 'stale' && <span className="mdr-stale-badge">⚠ couldn't locate</span>}
        "{comment.quote}"
      </div>
      {editing ? (
        <>
          <textarea className="mdr-composer" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="mdr-card-actions">
            <button className="mdr-btn" onClick={() => { setDraft(comment.commentText); setEditing(false) }}>✕</button>
            <button className="mdr-btn mdr-btn-ok" onClick={() => { onUpdate(comment.id, draft); setEditing(false) }}>✓</button>
          </div>
        </>
      ) : (
        <>
          <div className="mdr-card-text">{comment.commentText}</div>
          <div className="mdr-card-meta">
            <button className="mdr-link" onClick={(e) => { e.stopPropagation(); setEditing(true) }}>✎ edit</button>
            <button className="mdr-link" onClick={(e) => { e.stopPropagation(); onDelete(comment.id) }}>🗑 delete</button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement `CommentsRail.tsx`**

```tsx
import type { ReviewComment } from '../types'
import { CommentCard } from './CommentCard'

interface CommentsRailProps {
  comments: ReviewComment[]
  activeId: string | null
  onFocus: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
}

export function CommentsRail({ comments, activeId, onFocus, onUpdate, onDelete }: CommentsRailProps) {
  const sorted = [...comments].sort((a, b) => a.startOffset - b.startOffset)
  return (
    <div className="mdr-rail">
      <div className="mdr-rail-header">Comments</div>
      {sorted.length === 0 && <div className="mdr-rail-empty">Highlight text in the preview to add a comment.</div>}
      {sorted.map((c) => (
        <CommentCard
          key={c.id}
          comment={c}
          active={c.id === activeId}
          onFocus={onFocus}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/comments/Composer.tsx src/renderer/comments/CommentCard.tsx src/renderer/comments/CommentsRail.tsx
git commit -m "feat: composer, comment card, and comments rail components"
```

---

## Task 15: EditorPane (CodeMirror slide-in)

**Files:**
- Create: `src/renderer/editor/EditorPane.tsx`

- [ ] **Step 1: Implement `EditorPane.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'

interface EditorPaneProps {
  value: string
  onChange: (value: string) => void
}

export function EditorPane({ value, onChange }: EditorPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString())
          })
        ]
      })
    })
    viewRef.current = view
    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes (e.g. file reload) without clobbering local edits.
  useEffect(() => {
    const view = viewRef.current
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  return <div className="mdr-editor" ref={hostRef} />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/editor/EditorPane.tsx
git commit -m "feat: CodeMirror markdown editor pane"
```

---

## Task 16: Toolbar + Toast + useComments hook

**Files:**
- Create: `src/renderer/ui/Toolbar.tsx`
- Create: `src/renderer/ui/Toast.tsx`
- Create: `src/renderer/comments/useComments.ts`

- [ ] **Step 1: Implement `useComments.ts`**

```ts
import { useReducer } from 'react'
import { commentsReducer, type CommentsAction } from './commentsState'
import type { ReviewComment } from '../types'

export function useComments(initial: ReviewComment[] = []) {
  const [comments, dispatch] = useReducer(commentsReducer, initial)
  return { comments, dispatch: dispatch as (a: CommentsAction) => void }
}
```

- [ ] **Step 2: Implement `Toolbar.tsx`**

```tsx
interface ToolbarProps {
  title: string
  dirty: boolean
  editing: boolean
  onToggleEdit: () => void
  onCopy: () => void
}

export function Toolbar({ title, dirty, editing, onToggleEdit, onCopy }: ToolbarProps) {
  return (
    <div className="mdr-toolbar">
      <div className="mdr-title">{title}{dirty ? ' •' : ''}</div>
      <div className="mdr-toolbar-actions">
        <button className={`mdr-toggle${editing ? ' on' : ''}`} onClick={onToggleEdit}>✎ Edit</button>
        <button className="mdr-copy" onClick={onCopy}>Copy Comments</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement `Toast.tsx`**

```tsx
import { useEffect } from 'react'

interface ToastProps {
  message: string | null
  onClear: () => void
}

export function Toast({ message, onClear }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClear, 1800)
    return () => clearTimeout(t)
  }, [message, onClear])
  if (!message) return null
  return <div className="mdr-toast">{message}</div>
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ui/Toolbar.tsx src/renderer/ui/Toast.tsx src/renderer/comments/useComments.ts
git commit -m "feat: toolbar, toast, and useComments hook"
```

---

## Task 17: App wiring + styles (full integration)

This is where everything connects: load file → render preview → re-anchor saved comments → apply highlights → handle selection → composer → save → sidecar → copy. Also the editor slide-in and dirty/save handling.

**Files:**
- Modify: `src/renderer/App.tsx` (replace Task 1 stub)
- Create: `src/renderer/styles.css`
- Modify: `src/renderer/main.tsx` (import styles)

- [ ] **Step 1: Replace `src/renderer/App.tsx`**

```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Preview } from './markdown/Preview'
import { EditorPane } from './editor/EditorPane'
import { CommentsRail } from './comments/CommentsRail'
import { Composer } from './comments/Composer'
import { Toolbar } from './ui/Toolbar'
import { Toast } from './ui/Toast'
import { useComments } from './comments/useComments'
import { makeComment } from './comments/commentsState'
import { extractText } from './anchoring/extractText'
import { rangeToOffsets } from './anchoring/offsets'
import { buildAnchorFields, resolveOffsets } from './anchoring/anchor'
import { applyHighlights } from './anchoring/highlight'
import { formatComments } from './clipboard/formatComments'
import type { ReviewComment } from './types'

interface PendingSelection {
  startOffset: number
  endOffset: number
  quote: string
  prefix: string
  suffix: string
  top: number
}

export default function App() {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [source, setSource] = useState<string>('# Open a markdown file\n\nUse md-reviewer as the default app for `.md` files.')
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingSelection | null>(null)

  const { comments, dispatch } = useComments([])
  const previewRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Load file from main process ---
  useEffect(() => {
    window.api.onFileOpened(({ path, content, comments }) => {
      setFilePath(path)
      setSource(content)
      setDirty(false)
      dispatch({ type: 'load', comments })
    })
  }, [dispatch])

  // --- Re-anchor + highlight whenever the rendered text or comment set changes ---
  useLayoutEffect(() => {
    const root = previewRef.current
    if (!root) return
    const { text } = extractText(root)
    const resolved = comments.map((c) => ({ id: c.id, ...resolveOffsets(text, c) }))
    const changed = resolved.some((r) => {
      const c = comments.find((x) => x.id === r.id)!
      return c.startOffset !== r.startOffset || c.endOffset !== r.endOffset || c.status !== r.status
    })
    if (changed) dispatch({ type: 'resolve', resolved })
    applyHighlights(
      root,
      comments.map((c) => ({ id: c.id, startOffset: c.startOffset, endOffset: c.endOffset, status: c.status }))
    )
  }, [source, comments, dispatch])

  // --- Debounced sidecar persistence ---
  useEffect(() => {
    if (!filePath) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      window.api.saveComments(comments, source)
    }, 400)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [comments, source, filePath])

  // --- Selection -> pending composer ---
  const handleMouseUp = useCallback(() => {
    const root = previewRef.current
    if (!root) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return
    const ext = extractText(root)
    const offsets = rangeToOffsets(ext, range)
    if (!offsets || offsets.startOffset === offsets.endOffset) return
    const fields = buildAnchorFields(ext.text, offsets.startOffset, offsets.endOffset)
    const rect = range.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    setPending({ ...offsets, ...fields, top: rect.top - rootRect.top + root.scrollTop })
  }, [])

  const saveComment = useCallback((text: string) => {
    if (!pending || !text.trim()) return
    const comment = makeComment({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      fields: { quote: pending.quote, prefix: pending.prefix, suffix: pending.suffix },
      startOffset: pending.startOffset,
      endOffset: pending.endOffset,
      commentText: text
    })
    dispatch({ type: 'add', comment })
    setPending(null)
    window.getSelection()?.removeAllRanges()
  }, [pending, dispatch])

  // --- Editing ---
  const handleEdit = useCallback((value: string) => {
    setSource(value)
    setDirty(true)
    window.api.setDirty(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        window.api.saveFile(source)
        setDirty(false)
        window.api.setDirty(false)
        setToast('Saved ✓')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [source])

  // --- Cross-focus: clicking a highlight focuses its card ---
  const handleMouseUpAndFocus = useCallback(() => {
    handleMouseUp()
    const sel = window.getSelection()
    if (sel && sel.isCollapsed) {
      const node = sel.anchorNode?.parentElement?.closest('mark[data-comment-id]')
      if (node) setActiveId(node.getAttribute('data-comment-id'))
    }
  }, [handleMouseUp])

  const focusComment = useCallback((id: string) => {
    setActiveId(id)
    const mark = previewRef.current?.querySelector(`mark[data-comment-id="${id}"]`)
    if (mark) {
      mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
      mark.classList.add('mdr-flash')
      setTimeout(() => mark.classList.remove('mdr-flash'), 700)
    }
  }, [])

  const copyComments = useCallback(async () => {
    await navigator.clipboard.writeText(formatComments(comments))
    setToast('Copied ✓')
  }, [comments])

  const title = filePath ? filePath.split('/').pop()! : 'md-reviewer'

  return (
    <div className="mdr-app">
      <Toolbar
        title={title}
        dirty={dirty}
        editing={editing}
        onToggleEdit={() => setEditing((v) => !v)}
        onCopy={copyComments}
      />
      <div className="mdr-body">
        {editing && (
          <div className="mdr-editor-pane">
            <EditorPane value={source} onChange={handleEdit} />
          </div>
        )}
        <Preview ref={previewRef} source={source} onMouseUp={handleMouseUpAndFocus} />
        <div className="mdr-rail-pane">
          {pending && (
            <div style={{ position: 'absolute', top: pending.top, right: 12, left: 12 }}>
              <Composer quote={pending.quote} onSave={saveComment} onCancel={() => setPending(null)} />
            </div>
          )}
          <CommentsRail
            comments={comments}
            activeId={activeId}
            onFocus={focusComment}
            onUpdate={(id, text) => dispatch({ type: 'updateText', id, commentText: text })}
            onDelete={(id) => dispatch({ type: 'delete', id })}
          />
        </div>
      </div>
      <Toast message={toast} onClear={() => setToast(null)} />
    </div>
  )
}
```

Note: the pending composer is absolutely positioned within the rail pane; when present it overlays the rail. This keeps the composer "in the sidebar, aligned to the selection" per the design.

- [ ] **Step 2: Create `src/renderer/styles.css`**

```css
:root {
  --bg: #ffffff; --fg: #1a1a1a; --muted: #6b7280; --border: #e5e7eb;
  --rail-bg: #f9fafb; --accent: #2563eb; --hl: rgba(255, 213, 0, 0.42);
  --hl-stale: rgba(150, 150, 150, 0.3); --ok: #16a34a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1e1e1e; --fg: #e6e6e6; --muted: #9ca3af; --border: #333;
    --rail-bg: #252526; --accent: #4f8cff; --hl: rgba(255, 213, 0, 0.34);
    --hl-stale: rgba(150,150,150,0.25); --ok: #34d399;
  }
}
* { box-sizing: border-box; }
body { margin: 0; }
.mdr-app { display: flex; flex-direction: column; height: 100vh; font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--fg); }
.mdr-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; padding-left: 84px; border-bottom: 1px solid var(--border); -webkit-app-region: drag; }
.mdr-toolbar button { -webkit-app-region: no-drag; }
.mdr-title { font-weight: 600; font-size: 13px; }
.mdr-toolbar-actions { display: flex; gap: 8px; }
.mdr-toggle, .mdr-copy { border: 1px solid var(--border); background: transparent; color: var(--fg); border-radius: 7px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
.mdr-toggle.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.mdr-copy { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.mdr-body { flex: 1; display: flex; min-height: 0; }
.mdr-editor-pane { width: 42%; border-right: 1px solid var(--border); overflow: auto; }
.mdr-editor { height: 100%; font-size: 13px; }
.mdr-preview { flex: 1; overflow: auto; padding: 28px 40px; line-height: 1.65; max-width: 100%; }
.mdr-preview h1, .mdr-preview h2 { border-bottom: 1px solid var(--border); padding-bottom: .3em; }
.mdr-preview pre { background: var(--rail-bg); padding: 12px; border-radius: 8px; overflow: auto; }
.mdr-preview code { font-family: ui-monospace, monospace; font-size: .9em; }
.mdr-rail-pane { width: 320px; border-left: 1px solid var(--border); background: var(--rail-bg); overflow: auto; position: relative; }
.mdr-rail { padding: 12px; }
.mdr-rail-header { font-weight: 600; font-size: 12px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.mdr-rail-empty { font-size: 12px; color: var(--muted); }
.mdr-card { border: 1px solid var(--border); border-radius: 9px; padding: 10px; margin-bottom: 10px; background: var(--bg); box-shadow: 0 1px 4px rgba(0,0,0,.06); cursor: pointer; }
.mdr-card-active { border-color: var(--accent); box-shadow: 0 2px 10px rgba(37,99,235,.18); }
.mdr-card-stale { opacity: .7; }
.mdr-quote { font-size: 11px; color: var(--muted); font-style: italic; border-left: 2px solid var(--hl); padding-left: 7px; margin-bottom: 7px; }
.mdr-stale-badge { display: inline-block; color: #b45309; font-style: normal; margin-right: 6px; }
.mdr-card-text { font-size: 13px; white-space: pre-wrap; }
.mdr-composer { width: 100%; min-height: 54px; border: 1px solid var(--border); border-radius: 7px; padding: 7px; font: inherit; font-size: 13px; resize: vertical; background: var(--bg); color: var(--fg); }
.mdr-card-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
.mdr-card-meta { display: flex; gap: 12px; margin-top: 7px; font-size: 11px; }
.mdr-link { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 11px; padding: 0; }
.mdr-btn { width: 28px; height: 26px; border: 1px solid var(--border); border-radius: 7px; background: var(--bg); color: var(--fg); cursor: pointer; }
.mdr-btn-ok { border-color: var(--ok); color: var(--ok); font-weight: 700; }
.mdr-btn-ok:disabled { opacity: .4; cursor: default; }
mark.mdr-highlight { background: var(--hl); border-radius: 2px; padding: 0 1px; cursor: pointer; }
mark.mdr-stale { background: var(--hl-stale); }
mark.mdr-flash { animation: mdr-flash 0.7s ease; }
@keyframes mdr-flash { 0%,100% { background: var(--hl); } 50% { background: var(--accent); } }
.mdr-toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); background: #111; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,.3); }
```

- [ ] **Step 3: Import styles in `src/renderer/main.tsx`**

Add as the first import:
```tsx
import './styles.css'
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`
In the window:
1. The default placeholder markdown renders.
2. Type some markdown after toggling **✎ Edit** — preview updates live; title shows a • dirty dot.
3. Toggle Edit off — preview is full width.
4. Select rendered text → a composer appears in the rail with the quoted text; type a comment, click ✓ → the text turns yellow and a card appears.
5. Click another highlight → its card highlights; click a card → the highlight flashes and scrolls into view.
6. Click **Copy Comments** → "Copied ✓" toast; paste into a text editor and confirm the format:
   ```
   Comments:
   - "..." <-- ...
   ```
Expected: all six behaviors work.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire app shell — preview, editor, comments, highlights, copy"
```

---

## Task 18: Packaging + default-app registration + end-to-end verification

**Files:**
- Modify: `package.json` (add `build` config)
- Create: `README.md`
- Create: `build/` (icon placeholder — optional)

- [ ] **Step 1: Add electron-builder config to `package.json`**

Add this top-level `"build"` key:
```json
"build": {
  "appId": "com.tanaynaik.mdreviewer",
  "productName": "md-reviewer",
  "files": ["out/**/*", "package.json"],
  "directories": { "buildResources": "build" },
  "mac": {
    "category": "public.app-category.developer-tools",
    "target": ["dir"],
    "fileAssociations": [
      {
        "ext": ["md", "markdown", "mdown"],
        "name": "Markdown Document",
        "role": "Editor",
        "rank": "Owner"
      }
    ]
  }
}
```

(`"target": ["dir"]` builds an unsigned `.app` in `dist/mac*/` — fastest for personal use. Switch to `["dmg"]` later for sharing.)

- [ ] **Step 2: Build the app**

Run: `npm run dist`
Expected: completes; produces `dist/mac-arm64/md-reviewer.app` (or `dist/mac/...` on Intel).

- [ ] **Step 3: Install + set as default**

```bash
cp -R "dist/mac-arm64/md-reviewer.app" /Applications/
```
Then in Finder: right-click any `.md` file → **Get Info** → expand **Open with** → choose **md-reviewer** → click **Change All…** → confirm.

- [ ] **Step 4: End-to-end verification**

1. Double-click a `.md` file in Finder → it opens in md-reviewer, rendered.
2. Highlight text, add 2 comments, click **Copy Comments**, paste into a terminal — verify the exact format.
3. Edit text, `⌘S`, confirm the file changed on disk (`cat` it).
4. Close the window, reopen the same file → comments reappear (sidecar at `<dir>/.md-reviewer/<file>.comments.json`).
5. Edit the `.md` externally to move a commented passage down, reopen → comment re-anchors to the moved text.
6. Delete a commented passage entirely, reopen → that comment shows greyed with "⚠ couldn't locate" and is still included in Copy.

Expected: all six pass.

- [ ] **Step 5: Write `README.md`**

````markdown
# md-reviewer

A macOS markdown reviewer. Open a `.md` file, read the rendered output, highlight
passages to leave comments in a sidebar, and copy all comments in one click to paste
into a coding agent.

## Develop
```bash
npm install
npm run dev
npm test
```

## Build & install
```bash
npm run dist
cp -R "dist/mac-arm64/md-reviewer.app" /Applications/
```

## Make it the default app for `.md`
Finder → right-click a `.md` file → Get Info → Open with → md-reviewer → **Change All…**
(macOS does not allow an app to claim this automatically; this one-time step is required.)

## Comments
Comments are stored next to each file in `<dir>/.md-reviewer/<file>.comments.json`.
When you reopen a file, comments re-anchor to their text; if the text changed too much,
the comment is shown as "couldn't locate" but is never dropped and is still copied.

## Copy format
```
Comments:
- "highlighted text" <-- your comment
- "more highlighted text" <-- another comment
```
````

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: packaging, file association, and README"
```

---

## Self-Review (completed during planning)

**Spec coverage:**
- Editor (edit markdown) → Tasks 15, 17. ✓
- Previewer (rendered markdown) → Tasks 13, 17. ✓
- Highlight rendered text → Tasks 5, 9, 17. ✓
- Floating composer in sidebar on highlight → Tasks 14, 17. ✓
- Save comment with ✓ → Tasks 14, 17. ✓
- Multiple comments in multiple places → Tasks 10, 14, 17. ✓
- Copy Comments button + exact format → Tasks 8, 16, 17. ✓
- Sidecar persistence + re-anchor + stale → Tasks 7, 11, 17. ✓
- Default `.md` app → Task 18. ✓
- macOS-first, shareable later → Electron + electron-builder (Tasks 1, 18). ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. UI-only components (Preview, editor) verified via the Task 17 integration pass rather than unit tests, which is called out explicitly.

**Type consistency:** `ReviewComment`/`CommentsDoc`/`CommentStatus` defined once (Task 3) and used identically across renderer and main. `extractText`→`ExtractedText`, `rangeToOffsets`/`offsetsToRange`, `buildAnchorFields`/`resolveOffsets`, `applyHighlights(HighlightRange[])`, `commentsReducer`/`makeComment`, preload `api` (`onFileOpened`/`saveFile`/`saveComments`/`setDirty`) — names match between definition and use. The renderer never imports Node modules; main imports types only from `../renderer/types`.
