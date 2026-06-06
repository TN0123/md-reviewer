import { contextBridge, ipcRenderer } from 'electron'
import type { ReviewComment } from '../renderer/types'

export interface FileOpenedPayload {
  path: string
  content: string
  comments: ReviewComment[]
}

const api = {
  onFileOpened(cb: (payload: FileOpenedPayload) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, payload: FileOpenedPayload) => cb(payload)
    ipcRenderer.on('file-opened', listener)
    return () => {
      ipcRenderer.removeListener('file-opened', listener)
    }
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
