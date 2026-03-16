import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { PageShell } from '../components/layout/PageShell'
import { Modal } from '../components/shared/Modal'
import { Button } from '../components/shared/Button'
import { useProjectContext } from '../context/ProjectContext'
import type { CuttingPlan, PlanType } from '../types/project'
import { defaultStockBars } from '../types/section'
import { defaultStockPlate } from '../types/plate'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { projects, updateProject, deletePlan } = useProjectContext()
  const navigate = useNavigate()
  const project = projects.find(p => p.id === id)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(project ?? null)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [planForm, setPlanForm] = useState({ type: 'section' as PlanType, name: '', notes: '' })

  if (!project) return <div className="p-6 text-slate-500">Project not found. <button className="text-blue-600" onClick={() => navigate('/')}>Back</button></div>

  const handleSaveProject = async () => {
    if (!form) return
    await updateProject(form)
    setEditing(false)
  }

  const handleNewPlan = async () => {
    if (!planForm.name.trim()) return
    const now = new Date().toISOString()
    const plan: CuttingPlan = {
      id: uuidv4(),
      projectId: project.id,
      type: planForm.type,
      name: planForm.name,
      notes: planForm.notes,
      createdAt: now,
      updatedAt: now,
      ...(planForm.type === 'section'
        ? { sectionData: { stockLengths: defaultStockBars(), kerf: 3, items: [], result: null } }
        : { plateData: { stockPlate: defaultStockPlate(), kerf: 3, items: [], result: null } }
      )
    }
    const updated = { ...project, plans: [...project.plans, plan] }
    await updateProject(updated)
    setShowNewPlan(false)
    navigate(`/project/${project.id}/${planForm.type}/${plan.id}`)
  }

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Delete plan "${planName}"?`)) return
    await deletePlan(project.id, planId)
  }

  const f = form ?? project

  return (
    <PageShell
      title={project.name}
      subtitle={`${project.client} | ${project.revision} | ${project.date}`}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← Projects</Button>
          <Button variant="secondary" size="sm" onClick={() => { setForm({ ...project }); setEditing(true) }}>Edit</Button>
          <Button variant="primary" size="sm" onClick={() => setShowNewPlan(true)}>+ New Plan</Button>
        </div>
      }
    >
      {/* Project Info */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          ['Project Name', project.name],
          ['Client', project.client],
          ['Engineer', project.engineer],
          ['Date', project.date],
          ['Revision', project.revision],
          ['Notes', project.notes],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-400 mb-0.5">{label}</div>
            <div className="text-sm font-medium text-slate-700">{value || '—'}</div>
          </div>
        ))}
      </div>

      {/* Plans */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-700">Cutting Plans ({project.plans.length})</h2>
      </div>

      {project.plans.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
          <div className="text-3xl mb-2">✂️</div>
          <div className="text-slate-500 text-sm">No cutting plans yet</div>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => setShowNewPlan(true)}>+ New Plan</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {project.plans.map(plan => (
            <div
              key={plan.id}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow cursor-pointer group transition-all"
              onClick={() => navigate(`/project/${project.id}/${plan.type}/${plan.id}`)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mb-2 inline-block
                    ${plan.type === 'section' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {plan.type === 'section' ? 'Section Steel' : 'Plate Cutting'}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-800">{plan.name}</h3>
                  {plan.notes && <p className="text-xs text-slate-400 mt-0.5">{plan.notes}</p>}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDeletePlan(plan.id, plan.name) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 text-lg leading-none"
                >✕</button>
              </div>
              <div className="mt-3 text-xs text-slate-400">
                {plan.type === 'section' && plan.sectionData && (
                  <span>{plan.sectionData.items.length} items | {plan.sectionData.result ? `${plan.sectionData.result.totalBarsUsed} bars` : 'Not optimized'}</span>
                )}
                {plan.type === 'plate' && plan.plateData && (
                  <span>{plan.plateData.items.length} items | {plan.plateData.result ? `${plan.plateData.result.totalPlatesUsed} plates` : 'Not optimized'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Project Modal */}
      <Modal open={editing} title="Edit Project" onClose={() => setEditing(false)}>
        <div className="space-y-4">
          {(['name', 'client', 'engineer', 'date', 'revision'] as const).map(key => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">{key}</label>
              <input
                type={key === 'date' ? 'date' : 'text'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                value={f[key]}
                onChange={e => setForm(prev => prev ? { ...prev, [key]: e.target.value } : null)}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              rows={3} value={f.notes} onChange={e => setForm(prev => prev ? { ...prev, notes: e.target.value } : null)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveProject}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* New Plan Modal */}
      <Modal open={showNewPlan} title="New Cutting Plan" onClose={() => setShowNewPlan(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Plan Type</label>
            <div className="grid grid-cols-2 gap-3">
              {(['section', 'plate'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setPlanForm(f => ({ ...f, type: t }))}
                  className={`border-2 rounded-xl p-4 text-center transition-all
                    ${planForm.type === t ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-2xl mb-1">{t === 'section' ? '⬛' : '🟩'}</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {t === 'section' ? 'Section Steel' : 'Plate Cutting'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {t === 'section' ? '1D bar optimization' : '2D plate nesting'}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Plan Name *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder={planForm.type === 'section' ? 'Main Structure Sections' : 'Gusset Plates'}
              value={planForm.name}
              onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              rows={2} value={planForm.notes} onChange={e => setPlanForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNewPlan(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleNewPlan} disabled={!planForm.name.trim()}>Create Plan</Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
