import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell'
import { Button } from '../components/shared/Button'
import { Modal } from '../components/shared/Modal'
import { PlateCutListEditor } from '../components/plate/PlateCutListEditor'
import { PlateResultPanel } from '../components/plate/PlateResultPanel'
import { PlateDetailModal } from '../components/plate/PlateDetailModal'
import { useProjectContext } from '../context/ProjectContext'
import { runGuillotineCut } from '../algorithms/guillotineCut'
import { exportPlatePlan, parsePlateExcel, generateTemplate } from '../services/excelService'
import { parseNc1 } from '../services/nc1Service'
import { storeService } from '../services/storeService'
import type { PlatePlanData, PlateItem } from '../types/plate'

export function PlatePlanPage() {
  const { id: projectId, planId } = useParams<{ id: string; planId: string }>()
  const { projects, savePlan } = useProjectContext()
  const navigate = useNavigate()

  const project = projects.find(p => p.id === projectId)
  const plan = project?.plans.find(p => p.id === planId)

  const [data, setData] = useState<PlatePlanData | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detailItem, setDetailItem] = useState<PlateItem | null>(null)

  useEffect(() => {
    if (plan?.plateData) setData({ ...plan.plateData })
  }, [plan?.id])

  if (!project || !plan || !data) return <div className="p-6 text-slate-500">Loading…</div>

  const handleSave = async () => {
    setSaving(true)
    await savePlan(project.id, { ...plan, plateData: data, updatedAt: new Date().toISOString() })
    setSaving(false)
  }

  const handleOptimize = async () => {
    if (data.items.length === 0) return
    setOptimizing(true)
    await new Promise(r => setTimeout(r, 50))
    const result = runGuillotineCut(data.items, data.stockPlate, data.kerf)
    const updated = { ...data, result }
    setData(updated)
    await savePlan(project.id, { ...plan, plateData: updated, updatedAt: new Date().toISOString() })
    setOptimizing(false)
  }

  const handleImport = async () => {
    const files = await storeService.openFile()
    if (!files || files.length === 0) return

    const allPlates: PlateItem[] = []
    const allWarnings: string[] = []

    for (const file of files) {
      const isNc1 = /\.(nc1?|dstv)$/i.test(file.name)
      if (isNc1) {
        const { plates, warnings } = parseNc1(file.buffer)
        allPlates.push(...plates)
        allWarnings.push(...warnings)
      } else {
        // Excel — only handle first selected file
        const { items, stock, warnings } = parsePlateExcel(file.buffer)
        setData(d => d ? { ...d, items: [...d.items, ...items], ...(stock ? { stockPlate: stock } : {}) } : d)
        if (warnings.length > 0) { setImportWarnings(warnings); setShowImportModal(true) }
        return
      }
    }

    if (allPlates.length > 0) {
      setData(d => d ? { ...d, items: [...d.items, ...allPlates] } : d)
    }
    if (allWarnings.length > 0) {
      setImportWarnings(allWarnings); setShowImportModal(true)
    } else if (allPlates.length === 0) {
      setImportWarnings(['No plate items found in selected NC1 files. Plate pieces must use PL or FL profile prefix (e.g. PL10).'])
      setShowImportModal(true)
    }
  }

  const handleExport = async () => {
    if (!data.result) { alert('Run optimization first before exporting.'); return }
    const buffer = exportPlatePlan(project, { ...plan, plateData: data })
    const fileName = `${project.name}_${plan.name}_plate.xlsx`.replace(/[/\\?%*:|"<>]/g, '-')
    await storeService.saveFile(buffer, fileName)
  }

  const handleTemplate = async () => {
    const buffer = generateTemplate('plate')
    await storeService.saveFile(buffer, 'plate_template.xlsx')
  }

  const sp = data.stockPlate

  return (
    <PageShell
      title={plan.name}
      subtitle={`${project.name} | Plate Cutting Optimization`}
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
      <div className="flex gap-5" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Left: config + cut list */}
        <div className="w-[440px] flex-shrink-0 flex flex-col gap-4">
          {/* Stock plate config */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Stock Plate</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { key: 'width', label: 'Width (mm)' },
                { key: 'height', label: 'Height (mm)' },
                { key: 'thickness', label: 'Thickness (mm)' },
                { key: 'count', label: 'Sheets (0=∞)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-slate-400 block mb-1">{label}</label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-right"
                    value={(sp as unknown as Record<string, number>)[key]}
                    onChange={e => setData(d => d ? { ...d, stockPlate: { ...d.stockPlate, [key]: Number(e.target.value) }, result: null } : d)}
                    min={0}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">Kerf width:</span>
              <input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-right text-xs"
                value={data.kerf} onChange={e => setData(d => d ? { ...d, kerf: Number(e.target.value), result: null } : d)} min={0} max={20} />
              <span className="text-xs text-slate-400">mm</span>
              <span className="text-xs text-slate-400 ml-auto">
                Area: {(sp.width * sp.height / 1e6).toFixed(3)} m²
              </span>
            </div>
          </div>

          {/* Cut list editor */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1">
            <PlateCutListEditor
              items={data.items}
              onChange={items => setData(d => d ? { ...d, items, result: null } : d)}
              onViewDetail={item => setDetailItem(item)}
            />
          </div>

          {/* Optimize button */}
          <button
            onClick={handleOptimize}
            disabled={optimizing || data.items.length === 0}
            className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-semibold text-sm transition-colors"
          >
            {optimizing ? '⏳ Optimizing…' : '🔧 Run Optimization'}
          </button>
        </div>

        {/* Right: results */}
        <div className="flex-1 min-w-0">
          {data.result ? (
            <PlateResultPanel result={data.result} items={data.items} />
          ) : (
            <div className="h-full flex items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-xl">
              <div className="text-center">
                <div className="text-4xl mb-3">🟩</div>
                <div className="text-slate-400 text-sm">Add plate items and click<br /><strong>Run Optimization</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>

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

      {detailItem && (
        <PlateDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </PageShell>
  )
}
