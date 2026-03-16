import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { SectionItem } from '../../types/section'
import { Button } from '../shared/Button'

interface Props {
  items: SectionItem[]
  onChange: (items: SectionItem[]) => void
}

const empty = (): SectionItem => ({
  id: uuidv4(), partName: '', profile: '', length: 0, quantity: 1, mark: ''
})

export function SectionCutListEditor({ items, onChange }: Props) {
  const [editId, setEditId] = useState<string | null>(null)

  const update = (id: string, field: keyof SectionItem, value: string | number) => {
    onChange(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const add = () => {
    const item = empty()
    onChange([...items, item])
    setEditId(item.id)
  }

  const remove = (id: string) => onChange(items.filter(i => i.id !== id))

  const duplicate = (item: SectionItem) => {
    onChange([...items, { ...item, id: uuidv4() }])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Cut List ({items.length} items, {items.reduce((s, i) => s + i.quantity, 0)} pcs)</span>
        <Button variant="primary" size="sm" onClick={add}>+ Add Row</Button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-2 py-2 text-left">Part Name</th>
              <th className="px-2 py-2 text-left">Profile</th>
              <th className="px-2 py-2 text-right">Length (mm)</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-left">Mark</th>
              <th className="px-2 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No items. Click + Add Row.</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-2 py-1">
                  <input
                    className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.partName}
                    onChange={e => update(item.id, 'partName', e.target.value)}
                    placeholder="Part name"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.profile}
                    onChange={e => update(item.id, 'profile', e.target.value)}
                    placeholder="IPE 200"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none text-right"
                    value={item.length || ''}
                    onChange={e => update(item.id, 'length', Number(e.target.value))}
                    placeholder="0"
                    min={1}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    className="w-16 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none text-right"
                    value={item.quantity || ''}
                    onChange={e => update(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                    placeholder="1"
                    min={1}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 outline-none"
                    value={item.mark}
                    onChange={e => update(item.id, 'mark', e.target.value)}
                    placeholder="S-01"
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => duplicate(item)} title="Duplicate" className="text-slate-400 hover:text-blue-600 px-1">⧉</button>
                    <button onClick={() => remove(item.id)} title="Delete" className="text-slate-400 hover:text-red-600 px-1">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-400">
        Total pieces: {items.reduce((s, i) => s + i.quantity, 0)} | Total length: {(items.reduce((s, i) => s + i.length * i.quantity, 0) / 1000).toFixed(2)} m
      </div>
    </div>
  )
}
