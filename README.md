# md-reviewer

A macOS markdown reviewer. Open a `.md` file, read the rendered output, highlight passages
to leave comments in a sidebar, and copy all comments in one click to paste into a coding agent.

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
