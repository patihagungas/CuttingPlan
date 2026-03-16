export interface SectionItem {
  id: string
  partName: string
  profile: string      // e.g. "IPE 200", "UNP 100", "L 80x80x8"
  length: number       // mm
  quantity: number
  mark: string
}

export interface StockBar {
  id: string
  length: number       // mm
  count: number        // 0 = unlimited
}

export interface SectionPlanData {
  stockLengths: StockBar[]
  kerf: number         // mm, default 3
  items: SectionItem[]
  result: SectionPlanResult | null
}

// Output
export interface BarCut {
  pieceId: string
  partName: string
  profile: string
  mark: string
  length: number
  startPos: number     // mm from bar start (for diagram)
}

export interface BarResult {
  barIndex: number
  stockLength: number
  cuts: BarCut[]
  wasteLength: number
  utilizationPct: number
}

export interface SectionPlanResult {
  bars: BarResult[]
  totalBarsUsed: number
  totalWasteMm: number
  totalUsedMm: number
  overallUtilizationPct: number
  unplacedItems: { item: SectionItem; remaining: number }[]
}

export const defaultStockBars = (): StockBar[] => [
  { id: 'stock-6m', length: 6000, count: 0 },
  { id: 'stock-12m', length: 12000, count: 0 },
]
