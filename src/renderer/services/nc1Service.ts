import { v4 as uuidv4 } from 'uuid'
import type { SectionItem } from '../types/section'
import type { PlateItem, BoltHole } from '../types/plate'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Nc1Contour {
  x: number
  y: number
}

export interface Nc1BoltHole {
  x: number
  y: number
  diameter: number
}

export interface Nc1Piece {
  fileName: string
  pieceMark: string
  assemblyMark: string
  mainPartMark: string
  steelGrade: string
  quantity: number
  profile: string       // e.g. "PL12", "IPE200", "HEA300"
  // Data block
  length: number        // mm
  width: number         // mm
  thickness: number     // mm
  skewAngle: number
  weight: number        // kg
  surfaceArea: number   // m²
  // Sections
  contour: Nc1Contour[]
  boltHoles: Nc1BoltHole[]
}

export interface Nc1ParseResult {
  pieces: Nc1Piece[]
  sections: SectionItem[]
  plates: PlateItem[]
  warnings: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(s: string): number {
  // Strip trailing letters like 'u', 's', 'mm' etc.
  return parseFloat(s.trim().replace(/[a-zA-Z]+$/, '').replace(',', '.')) || 0
}

function isPlateProfile(profile: string): boolean {
  return /^(PL|FL)\d/i.test(profile.trim())
}

// ─── Arc tessellation ─────────────────────────────────────────────────────────
// In NC1, AK segments with a non-zero radius (3rd column) are circular arcs.
// This converts an arc from (x1,y1) to (x2,y2) with radius R into polygon pts.
function tessellateArc(
  x1: number, y1: number,
  x2: number, y2: number,
  R: number,
): Nc1Contour[] {
  const r = Math.abs(R)
  const dx = x2 - x1, dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (r < 0.01 || dist < 0.01) return [{ x: x2, y: y2 }]
  if (dist > 2 * r + 1.0) return [{ x: x2, y: y2 }]

  const halfChord = dist / 2
  const d = Math.sqrt(Math.max(0, r * r - halfChord * halfChord))
  const ux = -dy / dist, uy = dx / dist // unit perp to chord

  // Positive R → center to the left of travel (CCW), negative R → right (CW)
  const sign = R >= 0 ? 1 : -1
  const cx = (x1 + x2) / 2 + sign * d * ux
  const cy = (y1 + y2) / 2 + sign * d * uy

  const theta1 = Math.atan2(y1 - cy, x1 - cx)
  const theta2 = Math.atan2(y2 - cy, x2 - cx)
  let sweep = theta2 - theta1
  if (R >= 0) { while (sweep <= 0) sweep += 2 * Math.PI }
  else        { while (sweep >= 0) sweep -= 2 * Math.PI }

  const steps = Math.max(6, Math.ceil(Math.abs(sweep) * 18 / Math.PI)) // ~10° each
  const pts: Nc1Contour[] = []
  for (let j = 1; j <= steps; j++) {
    const theta = theta1 + (j / steps) * sweep
    pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) })
  }
  return pts
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseNc1(buffer: ArrayBuffer): Nc1ParseResult {
  const text = new TextDecoder('utf-8').decode(buffer)
  const rawLines = text.split(/\r?\n/)
  const pieces: Nc1Piece[] = []
  const warnings: string[] = []

  let i = 0

  while (i < rawLines.length) {
    const line = rawLines[i].trim()

    // Each piece block starts with "**"
    if (!line.startsWith('**')) { i++; continue }

    const fileName = line.replace(/^\*\*\s*/, '').trim()
    i++

    // Read 7 header lines (piece mark, assembly mark, main part mark, steel grade, profile depth, quantity, profile type)
    const headerLines: string[] = []
    while (headerLines.length < 7 && i < rawLines.length) {
      const h = rawLines[i].trim()
      i++
      if (h === '' && headerLines.length === 0) continue // skip leading blanks before first header
      headerLines.push(h)
    }

    if (headerLines.length < 7) {
      warnings.push(`"${fileName}" — incomplete header, skipping`)
      continue
    }

    // DSTV NC1 header: [0]=order [1]=pieceMark [2]=drawingMark [3]=phaseMark [4]=steelGrade [5]=quantity [6]=profile
    const assemblyMark = headerLines[0]
    const pieceMark    = headerLines[1]
    const mainPartMark = headerLines[2]
    const steelGrade   = headerLines[4]
    const quantity     = Math.max(1, Math.round(parseNum(headerLines[5])))
    const profile      = headerLines[6].trim()

    // Expect "B" next (begin data)
    while (i < rawLines.length && rawLines[i].trim() !== 'B') i++
    if (i >= rawLines.length) { warnings.push(`"${fileName}" — missing B marker`); continue }
    i++ // skip "B"

    // Read 12 data values (one per line, skip blank/non-numeric lines)
    const dataValues: number[] = []
    while (dataValues.length < 12 && i < rawLines.length) {
      const dLine = rawLines[i].trim()
      if (dLine === 'AK' || dLine === 'BO' || dLine === 'EN') break
      i++
      if (dLine === '') continue
      // Check it looks like a number (possibly with trailing letter)
      if (/^-?\d/.test(dLine)) {
        dataValues.push(parseNum(dLine))
      }
    }

    const length      = dataValues[0] ?? 0
    const width       = dataValues[1] ?? 0
    const thickness   = dataValues[2] ?? 0
    const skewAngle   = dataValues[5] ?? 0
    const weight      = dataValues[6] ?? 0
    const surfaceArea = dataValues[7] ?? 0

    if (length <= 0) {
      warnings.push(`"${fileName}" (${pieceMark}) — length is 0, skipping`)
      continue
    }

    // Parse all sections (AK, IK, BO) in whatever order they appear, until EN or next piece.
    // DSTV files may place IK before AK and may have multiple IK blocks.
    const contour: Nc1Contour[] = []
    const boltHoles: Nc1BoltHole[] = []

    while (i < rawLines.length) {
      // Skip blank lines
      while (i < rawLines.length && rawLines[i].trim() === '') i++
      if (i >= rawLines.length) break

      const sectionTag = rawLines[i].trim()
      if (sectionTag === 'EN' || sectionTag.startsWith('**')) break

      i++ // consume section tag line

      if (sectionTag === 'AK') {
        // Outer contour — straight lines (r=0) and arcs (r≠0)
        const akRaw: Array<{ x: number; y: number; r: number }> = []
        let closingR = 0
        let isFirstVLine = true

        while (i < rawLines.length) {
          const akLine = rawLines[i].trim()
          if (akLine === 'AK' || akLine === 'IK' || akLine === 'BO' || akLine === 'EN' || akLine.startsWith('**')) break
          i++
          if (akLine === '') continue
          const parts = akLine.split(/\s+/).filter(Boolean)
          if (akLine.startsWith('v') && parts.length >= 3) {
            const x = parseNum(parts[1]), y = parseNum(parts[2])
            const r = parts.length >= 4 ? parseNum(parts[3]) : 0
            if (isFirstVLine) {
              closingR = r
              akRaw.push({ x, y, r: 0 })
              isFirstVLine = false
            } else {
              akRaw.push({ x, y, r })
            }
          } else if (parts.length >= 2 && /^-?\d/.test(parts[0])) {
            akRaw.push({
              x: parseNum(parts[0]),
              y: parseNum(parts[1]),
              r: parts.length >= 3 ? parseNum(parts[2]) : 0,
            })
          }
        }

        // Strip duplicate closing point
        if (akRaw.length >= 2) {
          const f = akRaw[0], l = akRaw[akRaw.length - 1]
          if (Math.abs(f.x - l.x) < 0.01 && Math.abs(f.y - l.y) < 0.01) akRaw.pop()
        }

        if (akRaw.length >= 2) {
          contour.push({ x: akRaw[0].x, y: akRaw[0].y })
          for (let k = 1; k < akRaw.length; k++) {
            const prev = akRaw[k - 1], curr = akRaw[k]
            if (Math.abs(curr.r) < 0.01) {
              contour.push({ x: curr.x, y: curr.y })
            } else {
              contour.push(...tessellateArc(prev.x, prev.y, curr.x, curr.y, curr.r))
            }
          }
          if (Math.abs(closingR) > 0.01) {
            const last = akRaw[akRaw.length - 1], first = akRaw[0]
            const arcPts = tessellateArc(last.x, last.y, first.x, first.y, closingR)
            contour.push(...arcPts.slice(0, -1))
          }
        }

      } else if (sectionTag === 'IK') {
        // Inner contour (cutout) — skip entirely, may appear multiple times
        while (i < rawLines.length) {
          const l = rawLines[i].trim()
          if (l === 'AK' || l === 'IK' || l === 'BO' || l === 'EN' || l.startsWith('**')) break
          i++
        }

      } else if (sectionTag === 'BO') {
        // Bolt holes: "v  Xs  Y  D" (X suffix can be 's' or 'o')
        while (i < rawLines.length) {
          const boLine = rawLines[i].trim()
          if (boLine === 'EN' || boLine.startsWith('**')) break
          i++
          if (boLine.startsWith('v')) {
            const parts = boLine.split(/\s+/).filter(Boolean)
            if (parts.length >= 4) {
              boltHoles.push({
                x: parseNum(parts[1]),
                y: parseNum(parts[2]),
                diameter: parseNum(parts[3]),
              })
            }
          }
        }

      } else {
        // Unknown section — skip until next known section tag
        while (i < rawLines.length) {
          const l = rawLines[i].trim()
          if (l === 'AK' || l === 'IK' || l === 'BO' || l === 'EN' || l.startsWith('**')) break
          i++
        }
      }
    }

    // Advance past EN
    while (i < rawLines.length && rawLines[i].trim() !== 'EN') i++
    if (i < rawLines.length) i++

    // Determine bounding box from contour if available, else use data block
    let pieceWidth = width
    let pieceHeight = length
    if (contour.length >= 3) {
      const xs = contour.map(p => p.x)
      const ys = contour.map(p => p.y)
      pieceWidth = Math.max(...xs) - Math.min(...xs)
      pieceHeight = Math.max(...ys) - Math.min(...ys)
      // If contour gives smaller than data block (e.g. skewed cuts), use data block
      if (pieceWidth <= 0) pieceWidth = width
      if (pieceHeight <= 0) pieceHeight = length
    }

    pieces.push({
      fileName, pieceMark, assemblyMark, mainPartMark, steelGrade,
      quantity, profile,
      length: pieceHeight > 0 ? pieceHeight : length,
      width: pieceWidth > 0 ? pieceWidth : width,
      thickness, skewAngle, weight, surfaceArea,
      contour, boltHoles,
    })
  }

  // ─── Convert to SectionItem / PlateItem ──────────────────────────────────

  const sections: SectionItem[] = []
  const plates: PlateItem[]     = []

  for (const p of pieces) {
    if (isPlateProfile(p.profile)) {
      // Plate piece
      // PL12 → thickness = 12 (from profile suffix)
      let t = p.thickness
      const plMatch = p.profile.match(/^(?:PL|FL)(\d+(?:[.,]\d+)?)/i)
      if (plMatch) t = parseNum(plMatch[1])

      if (p.length <= 0 || p.width <= 0) {
        warnings.push(`"${p.pieceMark}" — missing dimensions, skipped`)
        continue
      }

      // Normalize contour and bolt holes to piece origin (0,0)
      let contour: { x: number; y: number }[] | undefined
      let minX = 0, minY = 0
      if (p.contour.length >= 3) {
        minX = Math.min(...p.contour.map(pt => pt.x))
        minY = Math.min(...p.contour.map(pt => pt.y))
        let pts = p.contour.map(pt => ({ x: pt.x - minX, y: pt.y - minY }))
        // Strip duplicate closing point (NC1 files repeat the first point at the end)
        const first = pts[0], last = pts[pts.length - 1]
        if (Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01) {
          pts = pts.slice(0, -1)
        }
        if (pts.length >= 3) contour = pts
      }

      // Normalize bolt holes with same origin offset as contour
      let boltHoles: BoltHole[] | undefined
      if (p.boltHoles.length > 0) {
        boltHoles = p.boltHoles.map(h => ({
          x: h.x - minX,
          y: h.y - minY,
          diameter: h.diameter,
        }))
      }

      plates.push({
        id: uuidv4(),
        partName: p.pieceMark || p.profile,
        material: p.steelGrade || 'S275',
        thickness: t || 10,
        width: Math.round(p.width),
        height: Math.round(p.length),
        quantity: p.quantity,
        canRotate: true,
        mark: p.pieceMark,
        contour,
        boltHoles,
      })
    } else {
      // Section steel piece
      sections.push({
        id: uuidv4(),
        partName: p.pieceMark || p.profile,
        profile: p.profile,
        length: Math.round(p.length),
        quantity: p.quantity,
        mark: p.pieceMark,
      })
    }
  }

  return { pieces, sections, plates, warnings }
}
