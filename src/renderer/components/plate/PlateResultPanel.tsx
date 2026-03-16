import { useState } from 'react'
import type { PlatePlanResult, PlateItem } from '../../types/plate'
import { StatBadge, UtilizationBadge } from '../shared/Badge'
import { PlateCanvas } from './PlateCanvas'

const PIECE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
  '#84CC16', '#FB7185',
]

interface Props {
  result: PlatePlanResult
  items: PlateItem[]
}

export function PlateResultPanel({ result, items }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)

  const colorMap = new Map<string, string>()
  items.forEach((item, idx) => colorMap.set(item.id, PIECE_COLORS[idx % PIECE_COLORS.length]))

  const activePlate = result.plates[activeIdx]

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatBadge value={result.totalPlatesUsed} label="Plates Used" color="blue" />
        <StatBadge value={Math.round(result.totalWasteAreaMm2 / 1e4)} label="Waste Area (cm²)" color="yellow" />
        <StatBadge value={Math.round(result.totalUsedAreaMm2 / 1e6 * 100) / 100} label="Used Area (m²)" color="slate" />
        <div className="border border-slate-200 rounded-lg px-4 py-3 bg-slate-50">
          <div className="text-2xl font-bold text-slate-700">
            <UtilizationBadge pct={result.overallUtilizationPct} />
          </div>
          <div className="text-xs font-medium text-slate-500 mt-0.5">Overall Utilization</div>
        </div>
      </div>

      {/* Unplaced warning */}
      {result.unplacedItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-red-700 mb-1">⚠ Unplaced Items</div>
          {result.unplacedItems.map(item => (
            <div key={item.id} className="text-xs text-red-600">
              {item.partName} — {item.width}×{item.height}mm × {item.quantity} pcs could not fit
            </div>
          ))}
        </div>
      )}

      {/* Plate tabs + canvas */}
      {result.plates.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {result.plates.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIdx(idx)}
                className={`px-4 py-2 text-xs font-medium flex-shrink-0 border-b-2 transition-colors ${
                  activeIdx === idx
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Plate {p.plateIndex}
                <span className="ml-1.5 text-xs opacity-60">{p.utilizationPct.toFixed(0)}%</span>
              </button>
            ))}
          </div>

          {/* Canvas */}
          {activePlate && (
            <div className="p-4 flex gap-4">
              <div className="flex-shrink-0">
                <PlateCanvas plate={activePlate} colorMap={colorMap} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-600 mb-2">
                  Plate {activePlate.plateIndex} — {activePlate.stockWidth}×{activePlate.stockHeight}mm
                </div>
                <div className="flex gap-3 mb-3">
                  <div className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{activePlate.placements.length}</span> pieces
                  </div>
                  <div className="text-xs text-slate-500">
                    Waste: <span className="font-medium text-yellow-700">{(activePlate.wasteAreaMm2 / 1e4).toFixed(1)} cm²</span>
                  </div>
                  <div>
                    <UtilizationBadge pct={activePlate.utilizationPct} />
                  </div>
                </div>

                {/* Piece legend */}
                <div className="space-y-1 overflow-auto max-h-56">
                  {activePlate.placements.map((p, i) => {
                    const color = colorMap.get(p.pieceId) ?? PIECE_COLORS[i % PIECE_COLORS.length]
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-slate-700 font-medium">{p.partName}</span>
                        {p.mark && <span className="text-slate-400">[{p.mark}]</span>}
                        <span className="text-slate-500">{p.width}×{p.height}mm</span>
                        {p.rotated && <span className="text-amber-600 text-[10px]">↻ rotated</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
