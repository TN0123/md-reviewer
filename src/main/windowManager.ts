import { BrowserWindow } from 'electron'
import { basename, join } from 'path'

export interface DocWindow {
  win: BrowserWindow
  filePath: string | null
  dirty: boolean
}

const windows = new Set<DocWindow>()

function loadWindow(win: BrowserWindow): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'))
}

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

  const doc: DocWindow = { win, filePath: null, dirty: false }
  windows.add(doc)

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => windows.delete(doc))
  loadWindow(win)
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

export function setWindowDocPath(doc: DocWindow, filePath: string): void {
  doc.filePath = filePath
  doc.win.setTitle(basename(filePath))
  doc.win.setDocumentEdited(doc.dirty)
}
