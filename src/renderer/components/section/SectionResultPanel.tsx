import type { SectionPlanResult, SectionItem } from '../../types/section'
import { StatBadge, UtilizationBadge } from '../shared/Badge'
import { SectionBarDiagram } from './SectionBarDiagram'

const PIECE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
  '#84CC16', '#FB7185',
]

interface Props {
  result: SectionPlanResult
  items: SectionItem[]
}

export function SectionResultPanel({ result, items }: Props) {
  // Build color map by pieceId (stable per item)
  const colorMap = new Map<string, string>()
  items.forEach((item, idx) => {
    colorMap.set(item.id, PIECE_COLORS[idx % PIECE_COLORS.length])
  })

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatBadge value={result.totalBarsUsed} label="Bars Used" color="blue" />
        <StatBadge value={Math.round(result.totalWasteMm)} label="Total Waste (mm)" color="yellow" />
        <StatBadge value={Math.round(result.totalUsedMm / 1000)} label="Used Length (m)" color="slate" />
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
          <div className="text-sm font-semibold text-red-700 mb-1">⚠ Unplaced Items (stock exhausted)</div>
          {result.unplacedItems.map(({ item, remaining }) => (
            <div key={item.id} className="text-xs text-red-600">
              {item.partName} [{item.profile}] — {remaining} pc(s) × {item.length}mm could not be placed
            </div>
          ))}
        </div>
      )}

      {/* Per-bar diagrams */}
      <div className="space-y-2">
        {result.bars.map(bar => (
          <SectionBarDiagram key={bar.barIndex} bar={bar} colorMap={colorMap} />
        ))}
      </div>

      {/* Summary table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">Bar Summary</div>
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Bar</th>
              <th className="px-3 py-2 text-right">Stock (mm)</th>
              <th className="px-3 py-2 text-right">Pieces</th>
              <th className="px-3 py-2 text-right">Waste (mm)</th>
              <th className="px-3 py-2 text-right">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {result.bars.map(bar => (
              <tr key={bar.barIndex} className="border-t border-slate-100">
                <td className="px-3 py-1.5">Bar {bar.barIndex}</td>
                <td className="px-3 py-1.5 text-right">{bar.stockLength}</td>
                <td className="px-3 py-1.5 text-right">{bar.cuts.length}</td>
                <td className="px-3 py-1.5 text-right text-yellow-700">{bar.wasteLength.toFixed(0)}</td>
                <td className="px-3 py-1.5 text-right"><UtilizationBadge pct={bar.utilizationPct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
