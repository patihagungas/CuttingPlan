import type { BarResult } from '../../types/section'
import { UtilizationBadge } from '../shared/Badge'

const PIECE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
  '#84CC16', '#FB7185',
]

interface Props {
  bar: BarResult
  colorMap: Map<string, string>
  zoom?: number
}

const BAR_HEIGHT = 44
const LABEL_MAX = 10
const BASE_W = 520

export function SectionBarDiagram({ bar, colorMap, zoom = 1 }: Props) {
  const total = bar.stockLength
  const W = BASE_W * zoom

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-600">
          Bar {bar.barIndex} — {(bar.stockLength / 1000).toFixed(1)} m
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Waste: {bar.wasteLength.toFixed(0)} mm</span>
          <UtilizationBadge pct={bar.utilizationPct} />
        </div>
      </div>

      <svg width={W} viewBox={`0 0 ${W} ${BAR_HEIGHT + 20}`} className="overflow-visible">
        {/* Background bar */}
        <rect x={0} y={0} width={W} height={BAR_HEIGHT} fill="#F1F5F9" rx={4} />

        {/* Cut segments */}
        {bar.cuts.map((cut, idx) => {
          const x = (cut.startPos / total) * W
          const w = Math.max(1, (cut.length / total) * W)
          const color = colorMap.get(cut.pieceId) ?? PIECE_COLORS[idx % PIECE_COLORS.length]
          const label = cut.partName.length > LABEL_MAX ? cut.partName.slice(0, LABEL_MAX) + '…' : cut.partName
          return (
            <g key={idx}>
              <rect x={x} y={2} width={w - 1} height={BAR_HEIGHT - 4} fill={color} rx={2}>
                <title>{cut.partName} | {cut.mark} | {cut.length} mm</title>
              </rect>
              {w > 30 && (
                <text x={x + w / 2} y={BAR_HEIGHT / 2 + 2} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">
                  {label}
                </text>
              )}
              {w > 30 && (
                <text x={x + w / 2} y={BAR_HEIGHT - 8} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize={7}>
                  {cut.length}
                </text>
              )}
            </g>
          )
        })}

        {/* Waste zone */}
        {bar.wasteLength > 0 && (
          <g>
            <rect
              x={W - (bar.wasteLength / total) * W}
              y={2}
              width={(bar.wasteLength / total) * W - 1}
              height={BAR_HEIGHT - 4}
              fill="url(#hatch)"
              stroke="#CBD5E1"
              strokeWidth={0.5}
              rx={2}
            />
            <text
              x={W - (bar.wasteLength / total) * W / 2}
              y={BAR_HEIGHT / 2 + 2}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize={8}
            >
              {bar.wasteLength > 50 ? `${bar.wasteLength.toFixed(0)} mm` : ''}
            </text>
          </g>
        )}

        {/* Hatch pattern */}
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} stroke="#CBD5E1" strokeWidth={2} />
          </pattern>
        </defs>

        {/* Scale bar */}
        <line x1={0} y1={BAR_HEIGHT + 6} x2={W} y2={BAR_HEIGHT + 6} stroke="#CBD5E1" strokeWidth={0.5} />
        <text x={0} y={BAR_HEIGHT + 16} fill="#94A3B8" fontSize={7}>0</text>
        <text x={W} y={BAR_HEIGHT + 16} textAnchor="end" fill="#94A3B8" fontSize={7}>{total} mm</text>
      </svg>

      {/* Cut list mini table */}
      <div className="mt-2 flex flex-wrap gap-1">
        {bar.cuts.map((cut, i) => {
          const color = colorMap.get(cut.pieceId) ?? PIECE_COLORS[i % PIECE_COLORS.length]
          return (
            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white" style={{ backgroundColor: color }}>
              {cut.partName} {cut.mark && `[${cut.mark}]`} {cut.length}mm
            </span>
          )
        })}
      </div>
    </div>
  )
}
