import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { existsSync } from 'fs'
import { basename } from 'path'
import { readMarkdown, writeMarkdown } from './fileService'
import { hashContent, readComments, writeComments } from './commentsStore'
import {
  createDocWindow,
  docForWebContents,
  hasWindows,
  setWindowDocPath,
  type DocWindow
} from './windowManager'
import type { CommentsDoc } from '../renderer/types'

const pendingPaths: string[] = []

function sendFile(doc: DocWindow, filePath: string): void {
  setWindowDocPath(doc, filePath)
  const content = readMarkdown(filePath)
  const commentsDoc = readComments(filePath)
  const payload = { path: filePath, content, comments: commentsDoc.comments }

  if (doc.win.webContents.isLoading()) {
    doc.win.webContents.once('did-finish-load', () => {
      doc.win.webContents.send('file-opened', payload)
    })
    return
  }

  doc.win.webContents.send('file-opened', payload)
}

function openPath(filePath: string): void {
  const doc = createDocWindow()
  sendFile(doc, filePath)
}

function openFromPicker(filePath: string, targetWin?: BrowserWindow | null): void {
  const doc = targetWin ? docForWebContents(targetWin.webContents.id) : undefined
  if (doc && !doc.filePath && !doc.dirty) {
    sendFile(doc, filePath)
  } else {
    openPath(filePath)
  }
}

async function promptOpenFile(targetWin?: BrowserWindow | null): Promise<void> {
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }

  const result = targetWin
    ? await dialog.showOpenDialog(targetWin, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) return
  openFromPicker(result.filePaths[0], targetWin)
}

function queuePath(filePath: string): void {
  if (!pendingPaths.includes(filePath)) pendingPaths.push(filePath)
}

function launchPaths(): string[] {
  const argv = app.isPackaged ? process.argv.slice(1) : process.argv.slice(2)
  return argv.filter((arg) => !arg.startsWith('-') && existsSync(arg))
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (app.isReady()) {
    openPath(filePath)
  } else {
    queuePath(filePath)
  }
})

function registerIpc(): void {
  ipcMain.handle('save-file', (_event, content: string) => {
    const doc = docForWebContents(_event.sender.id)
    if (!doc?.filePath) throw new Error('No file loaded')
    writeMarkdown(doc.filePath, content)
    doc.dirty = false
    doc.win.setDocumentEdited(false)
  })

  ipcMain.handle('save-comments', (_event, comments: CommentsDoc['comments'], sourceContent: string) => {
    const doc = docForWebContents(_event.sender.id)
    if (!doc?.filePath) throw new Error('No file loaded')
    const docToWrite: CommentsDoc = {
      version: 1,
      sourceFile: basename(doc.filePath),
      sourceHash: hashContent(sourceContent),
      comments
    }
    writeComments(doc.filePath, docToWrite)
  })

  ipcMain.on('set-dirty', (event, dirty: boolean) => {
    const doc = docForWebContents(event.sender.id)
    if (!doc) return
    doc.dirty = dirty
    doc.win.setDocumentEdited(dirty)
  })
}

function buildMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, win) => {
            void promptOpenFile(win instanceof BrowserWindow ? win : null)
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [{ label: 'md-reviewer', click: () => shell.openExternal('https://github.com') }]
    }
  ])
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu())
  registerIpc()

  const startupPaths = [...launchPaths(), ...pendingPaths]
  pendingPaths.length = 0

  if (startupPaths.length > 0) {
    startupPaths.forEach(openPath)
  } else {
    createDocWindow()
  }

  app.on('activate', () => {
    if (!hasWindows()) createDocWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
