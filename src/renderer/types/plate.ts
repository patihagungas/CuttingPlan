export interface Contour2D {
  x: number
  y: number
}

export interface BoltHole {
  x: number
  y: number
  diameter: number
}

export interface PlateItem {
  id: string
  partName: string
  material: string     // e.g. "A36", "S275"
  thickness: number    // mm
  width: number        // mm
  height: number       // mm
  quantity: number
  canRotate: boolean
  mark: string
  contour?: Contour2D[]   // polygon points relative to piece origin (0,0)
  boltHoles?: BoltHole[]  // bolt hole positions relative to piece origin (0,0)
}

export interface StockPlate {
  width: number        // mm
  height: number       // mm
  thickness: number    // mm
  count: number        // 0 = unlimited
}

export interface PlatePlanData {
  stockPlate: StockPlate
  kerf: number         // mm, default 3
  items: PlateItem[]
  result: PlatePlanResult | null
}

// Output
export interface PlacedRect {
  pieceId: string
  partName: string
  mark: string
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
  contour?: Contour2D[]   // polygon points relative to piece origin (0,0), after rotation
  boltHoles?: BoltHole[]  // bolt hole positions relative to piece origin (0,0), after rotation
}

export interface PlateResult {
  plateIndex: number
  stockWidth: number
  stockHeight: number
  placements: PlacedRect[]
  wasteAreaMm2: number
  utilizationPct: number
}

export interface PlatePlanResult {
  plates: PlateResult[]
  totalPlatesUsed: number
  totalWasteAreaMm2: number
  totalUsedAreaMm2: number
  overallUtilizationPct: number
  unplacedItems: PlateItem[]
}

export const defaultStockPlate = (): StockPlate => ({
  width: 2400,
  height: 1200,
  thickness: 10,
  count: 0,
})
