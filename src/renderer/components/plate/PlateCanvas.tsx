import { useState } from 'react'
import { Stage, Layer, Rect, Line, Text, Group, Circle } from 'react-konva'
import type { PlateResult } from '../../types/plate'

const PIECE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
  '#84CC16', '#FB7185',
]

interface Props {
  plate: PlateResult
  colorMap: Map<string, string>
  maxWidth?: number
  zoom?: number
}

const PAD = 20
const MAX_CANVAS = 640

export function PlateCanvas({ plate, colorMap, maxWidth = MAX_CANVAS, zoom = 1 }: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null)

  const baseScale = Math.min(
    (maxWidth - PAD * 2) / Math.max(1, plate.stockWidth),
    (400 - PAD * 2) / Math.max(1, plate.stockHeight)
  )
  const scale = baseScale * zoom

  const canvasW = plate.stockWidth * scale + PAD * 2
  const canvasH = plate.stockHeight * scale + PAD * 2

  return (
    <div className="relative overflow-auto">
      {tooltip && (
        <div className="absolute top-2 left-2 z-10 bg-black/75 text-white text-xs rounded px-2 py-1 pointer-events-none">
          {tooltip}
        </div>
      )}
      <Stage width={canvasW} height={canvasH}>
        <Layer>
          {/* Stock plate background */}
          <Rect
            x={PAD} y={PAD}
            width={plate.stockWidth * scale}
            height={plate.stockHeight * scale}
            fill="#F8FAFC"
            stroke="#94A3B8"
            strokeWidth={1}
          />

          {/* Pieces */}
          {plate.placements.map((p, idx) => {
            const color = colorMap.get(p.pieceId) ?? PIECE_COLORS[idx % PIECE_COLORS.length]
            const x = PAD + p.x * scale
            const y = PAD + p.y * scale
            const w = p.width * scale
            const h = p.height * scale
            const label = p.partName.length > 12 ? p.partName.slice(0, 12) + '…' : p.partName
            const hasContour = p.contour && p.contour.length >= 3
            const polyPoints = hasContour
              ? p.contour!.flatMap(pt => [x + pt.x * scale, y + pt.y * scale])
              : []

            return (
              <Group key={idx}
                onMouseEnter={() => setTooltip(`${p.partName}${p.mark ? ` [${p.mark}]` : ''} — ${p.width}×${p.height}mm${p.rotated ? ' (R)' : ''}`)}
                onMouseLeave={() => setTooltip(null)}
              >
                {hasContour
                  ? <Line points={polyPoints} closed fill={color} opacity={0.85} strokeWidth={0} />
                  : <Rect x={x} y={y} width={Math.max(1, w - 1)} height={Math.max(1, h - 1)} fill={color} cornerRadius={Math.min(2, Math.max(0, (w - 1) / 2, (h - 1) / 2))} opacity={0.85} />
                }
                {w > 25 && h > 16 && (
                  <Text
                    x={x + 3} y={y + h / 2 - 9}
                    width={w - 6} height={18}
                    text={label}
                    fontSize={Math.min(10, w / label.length * 1.2)}
                    fill="white"
                    fontStyle="bold"
                    align="center"
                    wrap="none"
                    ellipsis
                  />
                )}
                {w > 25 && h > 28 && (
                  <Text
                    x={x + 2} y={y + h / 2 + 3}
                    width={w - 4}
                    text={`${p.width}×${p.height}`}
                    fontSize={8}
                    fill="rgba(255,255,255,0.75)"
                    align="center"
                    wrap="none"
                  />
                )}
                {p.rotated && w > 18 && h > 18 && (
                  <Text x={x + 2} y={y + 2} text="R" fontSize={8} fill="rgba(255,255,255,0.6)" />
                )}
                {/* Bolt holes */}
                {p.boltHoles && p.boltHoles.map((hole, hi) => {
                  const hx = x + hole.x * scale
                  const hy = y + hole.y * scale
                  const hr = Math.max(2, (hole.diameter / 2) * scale)
                  return (
                    <Circle key={hi} x={hx} y={hy} radius={hr}
                      fill="white" stroke="rgba(0,0,0,0.6)" strokeWidth={0.5} />
                  )
                })}
              </Group>
            )
          })}

          {/* Dimension labels */}
          <Text x={PAD} y={canvasH - 14} text={`${plate.stockWidth} mm`} fontSize={9} fill="#64748B" />
          <Text x={12} y={PAD + plate.stockHeight * scale} text={`${plate.stockHeight} mm`} fontSize={9} fill="#64748B" rotation={-90} />
        </Layer>
      </Stage>
    </div>
  )
}
