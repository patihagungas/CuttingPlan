import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Project, CuttingPlan } from '../types/project'
import { storeService } from '../services/storeService'

interface ProjectContextValue {
  projects: Project[]
  loading: boolean
  createProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'plans'>) => Promise<Project>
  updateProject: (project: Project) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  savePlan: (projectId: string, plan: CuttingPlan) => Promise<void>
  deletePlan: (projectId: string, planId: string) => Promise<void>
  refresh: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await storeService.getProjects()
      setProjects(data ?? [])
    } catch (e) {
      console.error('Failed to load projects:', e)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'plans'>) => {
    const now = new Date().toISOString()
    const project: Project = { ...data, id: uuidv4(), createdAt: now, updatedAt: now, plans: [] }
    await storeService.saveProject(project)
    await refresh()
    return project
  }

  const updateProject = async (project: Project) => {
    await storeService.saveProject({ ...project, updatedAt: new Date().toISOString() })
    await refresh()
  }

  const deleteProject = async (id: string) => {
    await storeService.deleteProject(id)
    await refresh()
  }

  const savePlan = async (projectId: string, plan: CuttingPlan) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const updatedPlans = project.plans.some(p => p.id === plan.id)
      ? project.plans.map(p => p.id === plan.id ? plan : p)
      : [...project.plans, plan]
    await updateProject({ ...project, plans: updatedPlans })
  }

  const deletePlan = async (projectId: string, planId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    await updateProject({ ...project, plans: project.plans.filter(p => p.id !== planId) })
  }

  return (
    <ProjectContext.Provider value={{ projects, loading, createProject, updateProject, deleteProject, savePlan, deletePlan, refresh }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be used inside ProjectProvider')
  return ctx
}
