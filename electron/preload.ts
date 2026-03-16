import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getProjects: () => ipcRenderer.invoke('store:getProjects'),
  saveProject: (project: unknown) => ipcRenderer.invoke('store:saveProject', project),
  deleteProject: (id: string) => ipcRenderer.invoke('store:deleteProject', id),
  getProject: (id: string) => ipcRenderer.invoke('store:getProject', id),
  saveFile: (buffer: ArrayBuffer, defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', buffer, defaultName),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
})
