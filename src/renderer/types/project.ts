import type { SectionPlanData } from './section'
import type { PlatePlanData } from './plate'

export type PlanType = 'section' | 'plate'

export interface Project {
  id: string
  name: string
  client: string
  engineer: string
  date: string
  revision: string
  notes: string
  createdAt: string
  updatedAt: string
  plans: CuttingPlan[]
}

export interface CuttingPlan {
  id: string
  projectId: string
  type: PlanType
  name: string
  notes: string
  createdAt: string
  updatedAt: string
  sectionData?: SectionPlanData
  plateData?: PlatePlanData
}

export const emptyProject = (): Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'plans'> => ({
  name: '',
  client: '',
  engineer: '',
  date: new Date().toISOString().split('T')[0],
  revision: 'Rev A',
  notes: '',
})
