import type { Project } from '../types/project'

declare global {
  interface Window {
    electronAPI: {
      getProjects: () => Promise<Project[]>
      saveProject: (project: Project) => Promise<void>
      deleteProject: (id: string) => Promise<void>
      getProject: (id: string) => Promise<Project | undefined>
      saveFile: (buffer: ArrayBuffer, defaultName: string) => Promise<{ success: boolean; filePath?: string }>
      openFile: () => Promise<{ buffer: ArrayBuffer; name: string } | null>
    }
  }
}

function api() {
  if (!window.electronAPI) {
    console.error('electronAPI not available — preload may not be loaded')
    throw new Error('Electron API not available. Make sure the app is running in Electron.')
  }
  return window.electronAPI
}

export const storeService = {
  getProjects: (): Promise<Project[]> => api().getProjects(),
  saveProject: (project: Project): Promise<void> => api().saveProject(project),
  deleteProject: (id: string): Promise<void> => api().deleteProject(id),
  getProject: (id: string): Promise<Project | undefined> => api().getProject(id),
  saveFile: (buffer: ArrayBuffer, name: string) => api().saveFile(buffer, name),
  openFile: () => api().openFile(),
}
