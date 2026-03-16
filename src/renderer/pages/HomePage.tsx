import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell'
import { Modal } from '../components/shared/Modal'
import { Button } from '../components/shared/Button'
import { useProjectContext } from '../context/ProjectContext'
import { emptyProject } from '../types/project'

export function HomePage() {
  const { projects, loading, createProject, deleteProject } = useProjectContext()
  const navigate = useNavigate()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyProject())
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const project = await createProject(form)
    setSaving(false)
    setShowNew(false)
    setForm(emptyProject())
    navigate(`/project/${project.id}`)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}" and all its cutting plans?`)) return
    await deleteProject(id)
  }

  return (
    <PageShell
      title="Projects"
      subtitle="All steel cutting plan projects"
      actions={<Button variant="primary" onClick={() => setShowNew(true)}>+ New Project</Button>}
    >
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔩</div>
          <div className="text-lg font-semibold text-slate-600">No projects yet</div>
          <div className="text-sm text-slate-400 mt-1 mb-4">Create your first cutting plan project to get started</div>
          <Button variant="primary" onClick={() => setShowNew(true)}>+ New Project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-800 truncate">{project.name}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{project.client}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(project.id, project.name) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 text-lg leading-none ml-2 transition-opacity"
                >✕</button>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500 mb-3">
                <div><span className="text-slate-400">Engineer:</span> {project.engineer || '—'}</div>
                <div><span className="text-slate-400">Rev:</span> {project.revision || '—'}</div>
                <div><span className="text-slate-400">Date:</span> {project.date}</div>
                <div><span className="text-slate-400">Plans:</span> {project.plans.length}</div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {project.plans.map(plan => (
                  <span
                    key={plan.id}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${plan.type === 'section' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}
                  >
                    {plan.type === 'section' ? '⬛' : '🟩'} {plan.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      <Modal open={showNew} title="New Project" onClose={() => setShowNew(false)}>
        <div className="space-y-4">
          {[
            { key: 'name', label: 'Project Name *', placeholder: 'Workshop Structure 2025' },
            { key: 'client', label: 'Client', placeholder: 'PT. Example Client' },
            { key: 'engineer', label: 'Engineer', placeholder: 'Eng. Name' },
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'revision', label: 'Revision', placeholder: 'Rev A' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input
                type={type || 'text'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder={placeholder}
                value={(form as Record<string, string>)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!form.name.trim() || saving}>
              {saving ? 'Creating…' : 'Create Project'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
