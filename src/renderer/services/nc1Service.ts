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
  profileDepth: number
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

    const pieceMark    = headerLines[0]
    const assemblyMark = headerLines[1]
    const mainPartMark = headerLines[2]
    const steelGrade   = headerLines[3]
    const profileDepth = parseNum(headerLines[4])
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

    // Skip blank lines between data block and sections
    while (i < rawLines.length && rawLines[i].trim() === '') i++

    // AK section (outer contour)
    // Format: first line is "v  X  Y  ..." subsequent lines are "X  Y  ..."
    const contour: Nc1Contour[] = []
    if (i < rawLines.length && rawLines[i].trim() === 'AK') {
      i++ // skip "AK"
      while (i < rawLines.length) {
        const akLine = rawLines[i].trim()
        // Stop at any section header
        if (akLine === 'IK' || akLine === 'BO' || akLine === 'EN' || akLine.startsWith('**')) break
        i++
        if (akLine === '') continue
        const parts = akLine.split(/\s+/).filter(Boolean)
        if (akLine.startsWith('v') && parts.length >= 3) {
          // First line format: v  X  Y  ...
          contour.push({ x: parseNum(parts[1]), y: parseNum(parts[2]) })
        } else if (parts.length >= 2 && /^-?\d/.test(parts[0])) {
          // Subsequent lines format: X  Y  ...
          contour.push({ x: parseNum(parts[0]), y: parseNum(parts[1]) })
        }
      }
    }

    // Skip IK section (inner contours / cutouts — not used for nesting)
    while (i < rawLines.length && rawLines[i].trim() === '') i++
    if (i < rawLines.length && rawLines[i].trim() === 'IK') {
      i++ // skip "IK"
      while (i < rawLines.length) {
        const l = rawLines[i].trim()
        if (l === 'BO' || l === 'EN' || l.startsWith('**')) break
        i++
      }
    }

    // Skip blank lines before BO
    while (i < rawLines.length && rawLines[i].trim() === '') i++

    // BO section (bolt holes) — all lines start with "v  Xs  Y  D"
    const boltHoles: Nc1BoltHole[] = []
    if (i < rawLines.length && rawLines[i].trim() === 'BO') {
      i++ // skip "BO"
      while (i < rawLines.length) {
        const boLine = rawLines[i].trim()
        if (boLine === 'EN' || boLine.startsWith('**')) break
        i++
        if (boLine.startsWith('v')) {
          const parts = boLine.split(/\s+/).filter(Boolean)
          // "v  80.51s  45.00  26.00"  (X suffix can be 's' or 'o')
          if (parts.length >= 4) {
            boltHoles.push({
              x: parseNum(parts[1]),
              y: parseNum(parts[2]),
              diameter: parseNum(parts[3]),
            })
          }
        }
      }
    }

    // Advance to EN
    while (i < rawLines.length && rawLines[i].trim() !== 'EN') i++
    if (i < rawLines.length) i++ // skip "EN"

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
      profileDepth, quantity, profile,
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
