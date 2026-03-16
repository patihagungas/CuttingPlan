import type { PlateItem, StockPlate, PlacedRect, PlateResult, PlatePlanResult, Contour2D, BoltHole } from '../types/plate'

interface FreeRect {
  x: number
  y: number
  width: number
  height: number
}

interface PieceToPlace {
  pieceId: string
  partName: string
  mark: string
  width: number
  height: number
  canRotate: boolean
  contour?: Contour2D[]
  boltHoles?: BoltHole[]
}

interface ScoreResult {
  score: number
  freeRectIdx: number
  placedWidth: number
  placedHeight: number
  rotated: boolean
}

// Best Short Side Fit score
function scoreBSSF(fw: number, fh: number, pw: number, ph: number): number {
  return Math.min(fw - pw, fh - ph)
}

function findBestPlacement(
  piece: PieceToPlace,
  freeRects: FreeRect[],
  kerf: number
): ScoreResult | null {
  let best: ScoreResult | null = null

  for (let i = 0; i < freeRects.length; i++) {
    const fr = freeRects[i]
    const pw = piece.width + kerf
    const ph = piece.height + kerf

    if (fr.width >= pw && fr.height >= ph) {
      const score = scoreBSSF(fr.width, fr.height, pw, ph)
      if (best === null || score < best.score) {
        best = { score, freeRectIdx: i, placedWidth: piece.width, placedHeight: piece.height, rotated: false }
      }
    }

    if (piece.canRotate && piece.width !== piece.height) {
      const rw = piece.height + kerf
      const rh = piece.width + kerf
      if (fr.width >= rw && fr.height >= rh) {
        const score = scoreBSSF(fr.width, fr.height, rw, rh)
        if (best === null || score < best.score) {
          best = { score, freeRectIdx: i, placedWidth: piece.height, placedHeight: piece.width, rotated: true }
        }
      }
    }
  }

  return best
}

// MAXRECTS: split all free rects that overlap with the placed piece area
function splitFreeRect(
  fr: FreeRect,
  px: number, py: number, pw: number, ph: number
): FreeRect[] {
  // No overlap — keep as-is
  if (px >= fr.x + fr.width || px + pw <= fr.x || py >= fr.y + fr.height || py + ph <= fr.y) {
    return [fr]
  }

  const result: FreeRect[] = []

  // Left strip
  if (px > fr.x) {
    result.push({ x: fr.x, y: fr.y, width: px - fr.x, height: fr.height })
  }
  // Right strip
  if (px + pw < fr.x + fr.width) {
    result.push({ x: px + pw, y: fr.y, width: fr.x + fr.width - (px + pw), height: fr.height })
  }
  // Top strip
  if (py > fr.y) {
    result.push({ x: fr.x, y: fr.y, width: fr.width, height: py - fr.y })
  }
  // Bottom strip
  if (py + ph < fr.y + fr.height) {
    result.push({ x: fr.x, y: py + ph, width: fr.width, height: fr.y + fr.height - (py + ph) })
  }

  return result
}

function isContainedIn(a: FreeRect, b: FreeRect): boolean {
  return a.x >= b.x && a.y >= b.y &&
    a.x + a.width <= b.x + b.width &&
    a.y + a.height <= b.y + b.height
}

function pruneContained(rects: FreeRect[]): FreeRect[] {
  return rects.filter((r, i) => {
    for (let j = 0; j < rects.length; j++) {
      if (i !== j && isContainedIn(r, rects[j])) return false
    }
    return true
  })
}

function packOnePlate(
  pieces: PieceToPlace[],
  stock: StockPlate,
  kerf: number
): { placements: PlacedRect[]; remaining: PieceToPlace[] } {
  let freeRects: FreeRect[] = [{ x: 0, y: 0, width: stock.width, height: stock.height }]
  const placements: PlacedRect[] = []
  const remaining: PieceToPlace[] = []

  for (const piece of pieces) {
    const best = findBestPlacement(piece, freeRects, kerf)
    if (best === null) {
      remaining.push(piece)
      continue
    }

    const fr = freeRects[best.freeRectIdx]
    const px = fr.x
    const py = fr.y
    const pw = best.placedWidth + kerf
    const ph = best.placedHeight + kerf

    // Rotate contour and bolt holes 90° CW if piece was rotated: new_x = old_y, new_y = origW - old_x
    let placedContour = piece.contour
    let placedHoles = piece.boltHoles
    if (best.rotated) {
      const origW = piece.width
      if (piece.contour && piece.contour.length >= 3) {
        placedContour = piece.contour.map(pt => ({ x: pt.y, y: origW - pt.x }))
      }
      if (piece.boltHoles && piece.boltHoles.length > 0) {
        placedHoles = piece.boltHoles.map(h => ({ x: h.y, y: origW - h.x, diameter: h.diameter }))
      }
    }

    placements.push({
      pieceId: piece.pieceId,
      partName: piece.partName,
      mark: piece.mark,
      x: px,
      y: py,
      width: best.placedWidth,
      height: best.placedHeight,
      rotated: best.rotated,
      contour: placedContour,
      boltHoles: placedHoles,
    })

    // Split ALL free rects that overlap with the placed bounding box (including kerf)
    const newFreeRects: FreeRect[] = []
    for (const rect of freeRects) {
      const splits = splitFreeRect(rect, px, py, pw, ph)
      for (const s of splits) {
        if (s.width > 0 && s.height > 0) newFreeRects.push(s)
      }
    }

    freeRects = pruneContained(newFreeRects)
  }

  return { placements, remaining }
}

export function runGuillotineCut(
  items: PlateItem[],
  stock: StockPlate,
  kerf: number
): PlatePlanResult {
  const pieces: PieceToPlace[] = []
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      pieces.push({
        pieceId: item.id,
        partName: item.partName,
        mark: item.mark,
        width: item.width,
        height: item.height,
        canRotate: item.canRotate,
        contour: item.contour,
        boltHoles: item.boltHoles,
      })
    }
  }
  pieces.sort((a, b) => (b.width * b.height) - (a.width * a.height))

  const plates: PlateResult[] = []
  const stockArea = stock.width * stock.height
  let remaining = pieces
  let plateIdx = 1
  const maxPlates = stock.count > 0 ? stock.count : 999

  while (remaining.length > 0 && plateIdx <= maxPlates) {
    const { placements, remaining: leftover } = packOnePlate(remaining, stock, kerf)

    if (placements.length === 0) break

    const usedArea = placements.reduce((sum, p) => sum + p.width * p.height, 0)
    plates.push({
      plateIndex: plateIdx++,
      stockWidth: stock.width,
      stockHeight: stock.height,
      placements,
      wasteAreaMm2: stockArea - usedArea,
      utilizationPct: (usedArea / stockArea) * 100,
    })

    remaining = leftover
  }

  const unplacedIds = new Set(remaining.map(p => p.pieceId))
  const unplacedItems = items.filter(item => unplacedIds.has(item.id))

  const totalUsedArea = plates.reduce((sum, p) => sum + stockArea - p.wasteAreaMm2, 0)
  const totalWasteArea = plates.reduce((sum, p) => sum + p.wasteAreaMm2, 0)
  const totalArea = plates.length * stockArea

  return {
    plates,
    totalPlatesUsed: plates.length,
    totalWasteAreaMm2: totalWasteArea,
    totalUsedAreaMm2: totalUsedArea,
    overallUtilizationPct: totalArea > 0 ? (totalUsedArea / totalArea) * 100 : 0,
    unplacedItems,
  }
}
