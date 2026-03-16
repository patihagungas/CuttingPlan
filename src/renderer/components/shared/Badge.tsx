interface Props {
  value: number
  label: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'slate'
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
}

export function StatBadge({ value, label, color = 'slate' }: Props) {
  return (
    <div className={`border rounded-lg px-4 py-3 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </div>
  )
}

interface UtilBadgeProps { pct: number }
export function UtilizationBadge({ pct }: UtilBadgeProps) {
  const color = pct >= 90 ? 'green' : pct >= 75 ? 'blue' : pct >= 60 ? 'yellow' : 'red'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorMap[color]}`}>
      {pct.toFixed(1)}%
    </span>
  )
}
