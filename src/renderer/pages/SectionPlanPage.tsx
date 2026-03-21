import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { PageShell } from '../components/layout/PageShell'
import { Button } from '../components/shared/Button'
import { Modal } from '../components/shared/Modal'
import { SectionCutListEditor } from '../components/section/SectionCutListEditor'
import { SectionResultPanel } from '../components/section/SectionResultPanel'
import { useProjectContext } from '../context/ProjectContext'
import { runFirstFitDecreasing } from '../algorithms/firstFitDecreasing'
import { exportSectionPlan, parseSectionExcel, generateTemplate } from '../services/excelService'
import { parseNc1 } from '../services/nc1Service'
import { storeService } from '../services/storeService'
import type { SectionPlanData, StockBar, SectionItem } from '../types/section'

export function SectionPlanPage() {
  const { id: projectId, planId } = useParams<{ id: string; planId: string }>()
  const { projects, savePlan } = useProjectContext()
  const navigate = useNavigate()

  const project = projects.find(p => p.id === projectId)
  const plan = project?.plans.find(p => p.id === planId)

  const [data, setData] = useState<SectionPlanData | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newStock, setNewStock] = useState({ length: 6000, count: 0 })

  useEffect(() => {
    if (plan?.sectionData) setData({ ...plan.sectionData })
  }, [plan?.id])

  if (!project || !plan || !data) return <div className="p-6 text-slate-500">Loading…</div>

  const handleSave = async () => {
    setSaving(true)
    await savePlan(project.id, { ...plan, sectionData: data, updatedAt: new Date().toISOString() })
    setSaving(false)
  }

  const handleOptimize = async () => {
    if (data.items.length === 0) return
    setOptimizing(true)
    await new Promise(r => setTimeout(r, 50)) // allow UI to update
    const result = runFirstFitDecreasing(data.items, data.stockLengths, data.kerf)
    const updated = { ...data, result }
    setData(updated)
    await savePlan(project.id, { ...plan, sectionData: updated, updatedAt: new Date().toISOString() })
    setOptimizing(false)
  }

  const handleImport = async () => {
    const files = await storeService.openFile()
    if (!files || files.length === 0) return

    const allSections: SectionItem[] = []
    const allWarnings: string[] = []

    for (const file of files) {
      const isNc1 = /\.(nc1?|dstv)$/i.test(file.name)
      if (isNc1) {
        const { sections, warnings } = parseNc1(file.buffer)
        allSections.push(...sections)
        allWarnings.push(...warnings)
      } else {
        const { items, stocks, warnings } = parseSectionExcel(file.buffer)
        setData(d => d ? { ...d, items: [...d.items, ...items], stockLengths: stocks.length > 0 ? stocks : d.stockLengths } : d)
        if (warnings.length > 0) { setImportWarnings(warnings); setShowImportModal(true) }
        return
      }
    }

    if (allSections.length > 0) {
      setData(d => d ? { ...d, items: [...d.items, ...allSections] } : d)
    }
    if (allWarnings.length > 0) {
      setImportWarnings(allWarnings); setShowImportModal(true)
    } else if (allSections.length === 0) {
      setImportWarnings(['No section items found in selected NC1 files.'])
      setShowImportModal(true)
    }
  }

  const handleExport = async () => {
    if (!data.result) { alert('Run optimization first before exporting.'); return }
    const buffer = exportSectionPlan(project, { ...plan, sectionData: data })
    const fileName = `${project.name}_${plan.name}_section.xlsx`.replace(/[/\\?%*:|"<>]/g, '-')
    await storeService.saveFile(buffer, fileName)
  }

  const handleTemplate = async () => {
    const buffer = generateTemplate('section')
    await storeService.saveFile(buffer, 'section_template.xlsx')
  }

  const addStock = () => {
    if (newStock.length <= 0) return
    setData(d => d ? { ...d, stockLengths: [...d.stockLengths, { id: uuidv4(), ...newStock }] } : d)
    setNewStock({ length: 6000, count: 0 })
  }

  const removeStock = (id: string) => {
    setData(d => d ? { ...d, stockLengths: d.stockLengths.filter(s => s.id !== id) } : d)
  }

  const updateStock = (id: string, field: keyof StockBar, value: number) => {
    setData(d => d ? { ...d, stockLengths: d.stockLengths.map(s => s.id === id ? { ...s, [field]: value } : s) } : d)
  }

  return (
    <PageShell
      title={plan.name}
      subtitle={`${project.name} | Section Steel Optimization`}
      actions={
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${project.id}`)}>← Back</Button>
          <Button variant="secondary" size="sm" onClick={handleTemplate}>↓ Template</Button>
          <Button variant="secondary" size="sm" onClick={handleImport}>↑ Import Excel / NC1</Button>
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={!data.result}>↓ Export Excel</Button>
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button>
        </div>
      }
    >
      <div className="flex gap-5 h-full" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Left: config + cut list */}
        <div className="w-[420px] flex-shrink-0 flex flex-col gap-4">
          {/* Stock configuration */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Stock Bar Lengths</div>
            <div className="space-y-1 mb-3">
              {data.stockLengths.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <input type="number" className="w-24 border border-slate-200 rounded px-2 py-1 text-right"
                    value={s.length} onChange={e => updateStock(s.id, 'length', Number(e.target.value))} />
                  <span className="text-slate-400">mm</span>
                  <input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-right"
                    value={s.count} onChange={e => updateStock(s.id, 'count', Number(e.target.value))} min={0} />
                  <span className="text-slate-400">pcs (0=∞)</span>
                  <button onClick={() => removeStock(s.id)} className="text-slate-300 hover:text-red-500 ml-auto">✕</button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs border-t border-slate-100 pt-2">
              <input type="number" className="w-24 border border-slate-200 rounded px-2 py-1 text-right"
                value={newStock.length} onChange={e => setNewStock(s => ({ ...s, length: Number(e.target.value) }))} />
              <span className="text-slate-400">mm</span>
              <input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-right"
                value={newStock.count} onChange={e => setNewStock(s => ({ ...s, count: Number(e.target.value) }))} min={0} />
              <Button variant="ghost" size="sm" onClick={addStock}>+ Add</Button>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">Kerf width:</span>
              <input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-right text-xs"
                value={data.kerf} onChange={e => setData(d => d ? { ...d, kerf: Number(e.target.value) } : d)} min={0} max={20} />
              <span className="text-xs text-slate-400">mm</span>
            </div>
          </div>

          {/* Cut list editor */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1">
            <SectionCutListEditor
              items={data.items}
              onChange={items => setData(d => d ? { ...d, items, result: null } : d)}
            />
          </div>

          {/* Optimize button */}
          <button
            onClick={handleOptimize}
            disabled={optimizing || data.items.length === 0 || data.stockLengths.length === 0}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-semibold text-sm transition-colors"
          >
            {optimizing ? '⏳ Optimizing…' : '🔧 Run Optimization'}
          </button>
        </div>

        {/* Right: results */}
        <div className="flex-1 min-w-0">
          {data.result ? (
            <SectionResultPanel result={data.result} items={data.items} />
          ) : (
            <div className="h-full flex items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-xl">
              <div className="text-center">
                <div className="text-4xl mb-3">⬛</div>
                <div className="text-slate-400 text-sm">Add items to the cut list and click<br /><strong>Run Optimization</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import warnings modal */}
      <Modal open={showImportModal} title="Import Warnings" onClose={() => setShowImportModal(false)}>
        <div className="space-y-2">
          {importWarnings.map((w, i) => (
            <div key={i} className="text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-yellow-800">{w}</div>
          ))}
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={() => setShowImportModal(false)}>OK</Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
