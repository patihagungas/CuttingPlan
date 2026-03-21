import type { PlateItem } from '../../types/plate'

interface Props {
  item: PlateItem
  onClose: () => void
}

const PAD = 48   // padding around plate for dimension labels
const MAX = 560  // max canvas size

export function PlateDetailModal({ item, onClose }: Props) {
  const W = item.width
  const H = item.height

  // Scale to fit
  const scale = Math.min((MAX - PAD * 2) / W, (MAX - PAD * 2) / H)
  const pw = W * scale
  const ph = H * scale
  const svgW = pw + PAD * 2
  const svgH = ph + PAD * 2
  const ox = PAD  // plate origin x in SVG
  const oy = PAD  // plate origin y in SVG

  // Contour polygon points in SVG space (NC1 Y=0 → top of plate in screen)
  const contourPts = item.contour && item.contour.length >= 3
    ? item.contour.map(pt => `${ox + pt.x * scale},${oy + (H - pt.y) * scale}`).join(' ')
    : null

  const rectPoints = `${ox},${oy} ${ox + pw},${oy} ${ox + pw},${oy + ph} ${ox},${oy + ph}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl overflow-auto max-w-[95vw] max-h-[95vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div>
            <span className="font-bold text-slate-800 text-sm">{item.mark || item.partName}</span>
            <span className="ml-3 text-xs text-slate-500">
              PL{item.thickness} × {item.width} × {item.height} mm &nbsp;|&nbsp; {item.material} &nbsp;|&nbsp; Qty: {item.quantity}
              {item.boltHoles && item.boltHoles.length > 0 && ` | ${item.boltHoles.length} bolt holes ⌀${item.boltHoles[0].diameter.toFixed(1)} mm`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-6 text-slate-400 hover:text-slate-700 text-lg leading-none px-2"
          >
            ✕
          </button>
        </div>

        {/* Drawing */}
        <div className="p-4">
          <svg
            width={svgW}
            height={svgH}
            style={{ display: 'block', background: '#fff', fontFamily: 'monospace' }}
          >
            {/* Plate outline */}
            <polygon
              points={contourPts ?? rectPoints}
              fill="#f0f4f8"
              stroke="#1e293b"
              strokeWidth={1.5}
            />

            {/* Bolt holes */}
            {item.boltHoles?.map((hole, i) => {
              const hx = ox + hole.x * scale
              // NC1 Y=0 is bottom of plate; flip for screen (Y=0 = top)
              const hy = oy + (H - hole.y) * scale
              const hr = Math.max(3, (hole.diameter / 2) * scale)
              const cs = hr * 0.4  // crosshair size
              return (
                <g key={i}>
                  <circle cx={hx} cy={hy} r={hr} fill="#1e293b" />
                  {/* White crosshair */}
                  <line x1={hx - cs} y1={hy} x2={hx + cs} y2={hy} stroke="white" strokeWidth={1} />
                  <line x1={hx} y1={hy - cs} x2={hx} y2={hy + cs} stroke="white" strokeWidth={1} />
                </g>
              )
            })}

            {/* Width dimension (bottom) */}
            <line x1={ox} y1={oy + ph + 20} x2={ox + pw} y2={oy + ph + 20} stroke="#475569" strokeWidth={0.8} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <line x1={ox} y1={oy + ph + 4} x2={ox} y2={oy + ph + 28} stroke="#475569" strokeWidth={0.8} />
            <line x1={ox + pw} y1={oy + ph + 4} x2={ox + pw} y2={oy + ph + 28} stroke="#475569" strokeWidth={0.8} />
            <text x={ox + pw / 2} y={oy + ph + 36} textAnchor="middle" fontSize={11} fill="#1e293b">{W} mm</text>

            {/* Height dimension (left) */}
            <line x1={ox - 20} y1={oy} x2={ox - 20} y2={oy + ph} stroke="#475569" strokeWidth={0.8} />
            <line x1={ox - 28} y1={oy} x2={ox - 4} y2={oy} stroke="#475569" strokeWidth={0.8} />
            <line x1={ox - 28} y1={oy + ph} x2={ox - 4} y2={oy + ph} stroke="#475569" strokeWidth={0.8} />
            <text
              x={ox - 32}
              y={oy + ph / 2}
              textAnchor="middle"
              fontSize={11}
              fill="#1e293b"
              transform={`rotate(-90, ${ox - 32}, ${oy + ph / 2})`}
            >
              {H} mm
            </text>

            {/* Arrow marker */}
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#475569" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  )
}
