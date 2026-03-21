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
  pairedContour?: Contour2D[]  // flipped-180° contour of paired triangle piece
}

interface ScoreResult {
  score: number
  freeRectIdx: number
  placedWidth: number
  placedHeight: number
  rotated: boolean
}

// Best Short Side Fit score (lower = tighter fit on short side)
function scoreBSSF(fw: number, fh: number, pw: number, ph: number): number {
  return Math.min(fw - pw, fh - ph)
}

// Best Area Fit score (lower = less wasted area)
function scoreBAF(fw: number, fh: number, pw: number, ph: number): number {
  return fw * fh - pw * ph
}

function findBestPlacement(
  piece: PieceToPlace,
  freeRects: FreeRect[],
  kerf: number,
  useBAF = false,
): ScoreResult | null {
  let best: ScoreResult | null = null
  const scoreFn = useBAF ? scoreBAF : scoreBSSF

  for (let i = 0; i < freeRects.length; i++) {
    const fr = freeRects[i]
    const pw = piece.width + kerf
    const ph = piece.height + kerf

    if (fr.width >= pw && fr.height >= ph) {
      const score = scoreFn(fr.width, fr.height, pw, ph)
      if (best === null || score < best.score) {
        best = { score, freeRectIdx: i, placedWidth: piece.width, placedHeight: piece.height, rotated: false }
      }
    }

    if (piece.canRotate && piece.width !== piece.height) {
      const rw = piece.height + kerf
      const rh = piece.width + kerf
      if (fr.width >= rw && fr.height >= rh) {
        const score = scoreFn(fr.width, fr.height, rw, rh)
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

// ─── Triangle pairing ────────────────────────────────────────────────────────
// Two same-size triangular pieces (each ~50% of bounding box) can be packed
// together into one bounding box with zero waste: one normal + one flipped 180°.

function polygonArea(pts: Contour2D[]): number {
  let s = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return Math.abs(s) / 2
}

function isHalfFill(p: PieceToPlace): boolean {
  if (!p.contour || p.contour.length < 3) return false
  const bbox = p.width * p.height
  if (bbox === 0) return false
  const ratio = polygonArea(p.contour) / bbox
  return ratio > 0.35 && ratio < 0.65
}

function pairPieces(pieces: PieceToPlace[]): PieceToPlace[] {
  const out: PieceToPlace[] = []
  const used = new Set<number>()

  for (let i = 0; i < pieces.length; i++) {
    if (used.has(i)) continue
    const p = pieces[i]

    if (!isHalfFill(p)) { out.push(p); continue }

    // Find a partner of the same item type and same dimensions
    let found = -1
    for (let j = i + 1; j < pieces.length; j++) {
      if (used.has(j)) continue
      const q = pieces[j]
      if (q.pieceId === p.pieceId && q.width === p.width && q.height === p.height) {
        found = j; break
      }
    }

    if (found < 0) { out.push(p); continue }

    used.add(i); used.add(found)
    // Second triangle = first triangle flipped 180° (x→w-x, y→h-y)
    const flipped = p.contour!.map(pt => ({ x: p.width - pt.x, y: p.height - pt.y }))
    out.push({ ...p, pairedContour: flipped })
  }

  return out
}

function packOnePlate(
  pieces: PieceToPlace[],
  stock: StockPlate,
  kerf: number,
  useBAF = false,
): { placements: PlacedRect[]; remaining: PieceToPlace[] } {
  let freeRects: FreeRect[] = [{ x: 0, y: 0, width: stock.width, height: stock.height }]
  const placements: PlacedRect[] = []
  const remaining: PieceToPlace[] = []

  for (const piece of pieces) {
    const best = findBestPlacement(piece, freeRects, kerf, useBAF)
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
    let placedPairedContour = piece.pairedContour
    let placedHoles = piece.boltHoles
    if (best.rotated) {
      const origW = piece.width
      if (piece.contour && piece.contour.length >= 3) {
        placedContour = piece.contour.map(pt => ({ x: pt.y, y: origW - pt.x }))
      }
      if (piece.pairedContour && piece.pairedContour.length >= 3) {
        placedPairedContour = piece.pairedContour.map(pt => ({ x: pt.y, y: origW - pt.x }))
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
      pairedContour: placedPairedContour,
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

// Run all pieces against one stock plate, trying every possible rotation for each piece
function packOnePlateAllRotations(
  pieces: PieceToPlace[],
  stock: StockPlate,
  kerf: number,
  useBAF = false,
): { placements: PlacedRect[]; remaining: PieceToPlace[] } {
  // Force canRotate=true so every piece is tried both orientations
  const rotatable = pieces.map(p => ({ ...p, canRotate: true }))
  return packOnePlate(rotatable, stock, kerf, useBAF)
}

export function runGuillotineCut(
  items: PlateItem[],
  stock: StockPlate,
  kerf: number
): PlatePlanResult {
  const allPieces: PieceToPlace[] = []
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      allPieces.push({
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

  // Pair same-size half-fill pieces (triangles) into single bounding-box slots
  const pairedPieces = pairPieces(allPieces)

  const stockArea = stock.width * stock.height
  const maxPlates = stock.count > 0 ? stock.count : 999

  // Try multiple sort strategies — pick the one that places the most pieces on fewest plates
  type SortFn = (a: PieceToPlace, b: PieceToPlace) => number
  const sortStrategies: SortFn[] = [
    (a, b) => (b.width * b.height) - (a.width * a.height),                  // area desc (large first)
    (a, b) => (a.width * a.height) - (b.width * b.height),                  // area asc (small first)
    (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height),    // max-side desc
    (a, b) => Math.max(a.width, a.height) - Math.max(b.width, b.height),    // max-side asc
    (a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height),    // min-side desc
    (a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height),    // min-side asc
    (a, b) => (b.width + b.height) - (a.width + a.height),                  // perimeter desc
    (a, b) => (a.width + a.height) - (b.width + b.height),                  // perimeter asc
    (a, b) => b.height - a.height,                                           // height desc
    (a, b) => b.width - a.width,                                             // width desc
  ]

  let bestPlates: PlateResult[] = []
  let bestRemaining: PieceToPlace[] = pairedPieces
  let bestScore = -Infinity

  for (const sortFn of sortStrategies) {
    for (const useBAF of [false, true]) {
    const sorted = [...pairedPieces].sort(sortFn)
    const plates: PlateResult[] = []
    let remaining = sorted
    let plateIdx = 1

    while (remaining.length > 0 && plateIdx <= maxPlates) {
      const { placements, remaining: leftover } = packOnePlateAllRotations(remaining, stock, kerf, useBAF)
      if (placements.length === 0) break

      // Paired pieces share one bounding box — count area once (pairedContour is in same slot)
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

    // Score: maximise pieces placed, then minimise plates used, then maximise utilisation
    // Each paired piece represents 2 physical pieces
    const placed = pairedPieces.length - remaining.length
    const utilSum = plates.reduce((s, p) => s + p.utilizationPct, 0)
    const score = placed * 100000 - plates.length * 1000 + utilSum

    if (score > bestScore) {
      bestScore = score
      bestPlates = plates
      bestRemaining = remaining
    }
    } // end useBAF loop
  }

  bestPlates.forEach((p, i) => { p.plateIndex = i + 1 })

  const unplacedIds = new Set(bestRemaining.map(p => p.pieceId))
  const unplacedItems = items.filter(item => unplacedIds.has(item.id))

  const totalUsedArea = bestPlates.reduce((sum, p) => sum + stockArea - p.wasteAreaMm2, 0)
  const totalWasteArea = bestPlates.reduce((sum, p) => sum + p.wasteAreaMm2, 0)
  const totalArea = bestPlates.length * stockArea

  return {
    plates: bestPlates,
    totalPlatesUsed: bestPlates.length,
    totalWasteAreaMm2: totalWasteArea,
    totalUsedAreaMm2: totalUsedArea,
    overallUtilizationPct: totalArea > 0 ? (totalUsedArea / totalArea) * 100 : 0,
    unplacedItems,
  }
}
