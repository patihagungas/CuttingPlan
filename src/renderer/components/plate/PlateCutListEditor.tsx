import { v4 as uuidv4 } from 'uuid'
import type { PlateItem } from '../../types/plate'
import { Button } from '../shared/Button'

interface Props {
  items: PlateItem[]
  onChange: (items: PlateItem[]) => void
  onViewDetail?: (item: PlateItem) => void
}

const empty = (): PlateItem => ({
  id: uuidv4(), partName: '', material: 'A36', thickness: 10,
  width: 0, height: 0, quantity: 1, canRotate: true, mark: ''
})

export function PlateCutListEditor({ items, onChange, onViewDetail }: Props) {
  const update = (id: string, field: keyof PlateItem, value: string | number | boolean) => {
    onChange(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const add = () => onChange([...items, empty()])
  const remove = (id: string) => onChange(items.filter(i => i.id !== id))
  const duplicate = (item: PlateItem) => onChange([...items, { ...item, id: uuidv4() }])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          Cut List ({items.length} items, {items.reduce((s, i) => s + i.quantity, 0)} pcs)
        </span>
        <Button variant="primary" size="sm" onClick={add}>+ Add Row</Button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-2 py-2 text-left">Part Name</th>
              <th className="px-2 py-2 text-left">Mat.</th>
              <th className="px-2 py-2 text-right">Thk</th>
              <th className="px-2 py-2 text-right">W (mm)</th>
              <th className="px-2 py-2 text-right">H (mm)</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-center">Rot</th>
              <th className="px-2 py-2 text-left">Mark</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">No items. Click + Add Row.</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-2 py-1">
                  <input className="w-full bg-transparent border-0 focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.partName} onChange={e => update(item.id, 'partName', e.target.value)} placeholder="Name" />
                </td>
                <td className="px-2 py-1">
                  <input className="w-14 bg-transparent border-0 focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.material} onChange={e => update(item.id, 'material', e.target.value)} placeholder="A36" />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="w-12 bg-transparent border-0 text-right focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.thickness || ''} onChange={e => update(item.id, 'thickness', Number(e.target.value))} min={1} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="w-16 bg-transparent border-0 text-right focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.width || ''} onChange={e => update(item.id, 'width', Number(e.target.value))} min={1} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="w-16 bg-transparent border-0 text-right focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.height || ''} onChange={e => update(item.id, 'height', Number(e.target.value))} min={1} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="w-12 bg-transparent border-0 text-right focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.quantity || ''} onChange={e => update(item.id, 'quantity', Math.max(1, Number(e.target.value)))} min={1} />
                </td>
                <td className="px-2 py-1 text-center">
                  <input type="checkbox" checked={item.canRotate}
                    onChange={e => update(item.id, 'canRotate', e.target.checked)} className="w-3.5 h-3.5" />
                </td>
                <td className="px-2 py-1">
                  <input className="w-full bg-transparent border-0 focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.mark} onChange={e => update(item.id, 'mark', e.target.value)} placeholder="P-01" />
                </td>
                <td className="px-2 py-1">
                  <div className="flex gap-1">
                    {onViewDetail && (item.width > 0 || item.height > 0) && (
                      <button onClick={() => onViewDetail(item)} title="View Drawing" className="text-slate-400 hover:text-blue-600 px-1 rounded hover:bg-blue-50">📐</button>
                    )}
                    <button onClick={() => duplicate(item)} title="Duplicate" className="text-slate-400 hover:text-blue-600 px-1 rounded hover:bg-blue-50">⧉</button>
                    <button onClick={() => remove(item.id)} title="Delete row" className="text-red-400 hover:text-white hover:bg-red-500 font-bold px-1.5 py-0.5 rounded text-xs transition-colors">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-400">
        Total pcs: {items.reduce((s, i) => s + i.quantity, 0)} |
        Total area: {(items.reduce((s, i) => s + i.width * i.height * i.quantity, 0) / 1e6).toFixed(3)} m²
      </div>
    </div>
  )
}
