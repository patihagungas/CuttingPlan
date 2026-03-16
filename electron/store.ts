import Store from 'electron-store'
import type { Project } from '../src/types/project'

interface StoreSchema {
  projects: Project[]
}

const store = new Store<StoreSchema>({
  defaults: {
    projects: []
  }
})

export function getProjects(): Project[] {
  return store.get('projects', [])
}

export function saveProject(project: Project): void {
  const projects = getProjects()
  const idx = projects.findIndex(p => p.id === project.id)
  if (idx >= 0) {
    projects[idx] = project
  } else {
    projects.push(project)
  }
  store.set('projects', projects)
}

export function deleteProject(id: string): void {
  const projects = getProjects().filter(p => p.id !== id)
  store.set('projects', projects)
}

export function getProject(id: string): Project | undefined {
  return getProjects().find(p => p.id === id)
}
