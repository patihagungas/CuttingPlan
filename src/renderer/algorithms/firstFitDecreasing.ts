import type { SectionItem, StockBar, BarResult, BarCut, SectionPlanResult } from '../types/section'

interface Piece {
  pieceId: string
  partName: string
  profile: string
  mark: string
  length: number
}

interface OpenBar {
  stockLength: number
  remainingLength: number
  cuts: BarCut[]
}

function expandItems(items: SectionItem[]): Piece[] {
  const pieces: Piece[] = []
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      pieces.push({
        pieceId: item.id,
        partName: item.partName,
        profile: item.profile,
        mark: item.mark,
        length: item.length,
      })
    }
  }
  // Sort descending — FFD heuristic
  return pieces.sort((a, b) => b.length - a.length)
}

function pickStockLength(needed: number, stocks: StockBar[]): number | null {
  // Pick the shortest stock that fits the piece (greedy, minimize waste on new bar)
  const sorted = [...stocks]
    .filter(s => s.length >= needed)
    .sort((a, b) => a.length - b.length)
  return sorted.length > 0 ? sorted[0].length : null
}

export function runFirstFitDecreasing(
  items: SectionItem[],
  stocks: StockBar[],
  kerf: number
): SectionPlanResult {
  const pieces = expandItems(items)
  const openBars: OpenBar[] = []
  const stockUsage: Map<number, number> = new Map() // stockLength -> bars opened
  const unplacedMap: Map<string, { item: SectionItem; remaining: number }> = new Map()

  // Count limits per stock length
  const stockLimits: Map<number, number> = new Map()
  for (const s of stocks) {
    stockLimits.set(s.length, s.count) // 0 = unlimited
  }

  for (const piece of pieces) {
    if (piece.length <= 0) continue

    // Check if any existing bar can fit this piece
    let placed = false
    for (const bar of openBars) {
      const needed = piece.length + (bar.cuts.length > 0 ? kerf : 0)
      if (bar.remainingLength >= needed) {
        const startPos = bar.stockLength - bar.remainingLength + (bar.cuts.length > 0 ? kerf : 0)
        bar.cuts.push({
          pieceId: piece.pieceId,
          partName: piece.partName,
          profile: piece.profile,
          mark: piece.mark,
          length: piece.length,
          startPos,
        })
        bar.remainingLength -= needed
        placed = true
        break
      }
    }

    if (!placed) {
      // Open a new bar
      const stockLen = pickStockLength(piece.length, stocks)
      if (stockLen === null) {
        // Piece longer than any stock — unplaced
        const existing = unplacedMap.get(piece.pieceId)
        if (existing) {
          existing.remaining++
        } else {
          const originalItem = items.find(i => i.id === piece.pieceId)!
          unplacedMap.set(piece.pieceId, { item: originalItem, remaining: 1 })
        }
        continue
      }

      // Check count limit
      const used = stockUsage.get(stockLen) ?? 0
      const limit = stockLimits.get(stockLen) ?? 0
      if (limit > 0 && used >= limit) {
        // Stock exhausted — try next longer stock
        const altStock = pickStockLength(piece.length, stocks.filter(s => s.length > stockLen))
        if (altStock === null) {
          const existing = unplacedMap.get(piece.pieceId)
          if (existing) {
            existing.remaining++
          } else {
            const originalItem = items.find(i => i.id === piece.pieceId)!
            unplacedMap.set(piece.pieceId, { item: originalItem, remaining: 1 })
          }
          continue
        }
        stockUsage.set(altStock, (stockUsage.get(altStock) ?? 0) + 1)
        const newBar: OpenBar = {
          stockLength: altStock,
          remainingLength: altStock - piece.length,
          cuts: [{
            pieceId: piece.pieceId,
            partName: piece.partName,
            profile: piece.profile,
            mark: piece.mark,
            length: piece.length,
            startPos: 0,
          }],
        }
        openBars.push(newBar)
      } else {
        stockUsage.set(stockLen, used + 1)
        const newBar: OpenBar = {
          stockLength: stockLen,
          remainingLength: stockLen - piece.length,
          cuts: [{
            pieceId: piece.pieceId,
            partName: piece.partName,
            profile: piece.profile,
            mark: piece.mark,
            length: piece.length,
            startPos: 0,
          }],
        }
        openBars.push(newBar)
      }
    }
  }

  // Build results
  const bars: BarResult[] = openBars.map((bar, idx) => {
    const usedLength = bar.cuts.reduce((sum, c) => sum + c.length, 0) +
      Math.max(0, bar.cuts.length - 1) * kerf
    const wasteLength = bar.stockLength - usedLength
    const utilizationPct = (usedLength / bar.stockLength) * 100
    return {
      barIndex: idx + 1,
      stockLength: bar.stockLength,
      cuts: bar.cuts,
      wasteLength,
      utilizationPct,
    }
  })

  const totalUsedMm = bars.reduce((sum, b) => sum + (b.stockLength - b.wasteLength), 0)
  const totalStockMm = bars.reduce((sum, b) => sum + b.stockLength, 0)
  const totalWasteMm = bars.reduce((sum, b) => sum + b.wasteLength, 0)

  return {
    bars,
    totalBarsUsed: bars.length,
    totalWasteMm,
    totalUsedMm,
    overallUtilizationPct: totalStockMm > 0 ? (totalUsedMm / totalStockMm) * 100 : 0,
    unplacedItems: Array.from(unplacedMap.values()),
  }
}
