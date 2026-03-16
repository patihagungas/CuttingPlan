import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFile, readFile } from 'fs/promises'
import { getProjects, saveProject, deleteProject, getProject } from './store'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    title: 'CuttingPlan — TFe Group',
    icon: join(__dirname, '../../public/icon.ico'),
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC handlers
ipcMain.handle('store:getProjects', () => getProjects())
ipcMain.handle('store:saveProject', (_, project) => saveProject(project))
ipcMain.handle('store:deleteProject', (_, id) => deleteProject(id))
ipcMain.handle('store:getProject', (_, id) => getProject(id))

ipcMain.handle('dialog:saveFile', async (_, buffer: ArrayBuffer, defaultName: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  })
  if (canceled || !filePath) return { success: false }
  await writeFile(filePath, Buffer.from(buffer))
  return { success: true, filePath }
})

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return null
  const buffer = await readFile(filePaths[0])
  return { buffer: buffer.buffer, name: filePaths[0] }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
