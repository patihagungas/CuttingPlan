import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import type { SectionItem, StockBar, SectionPlanResult } from '../types/section'
import type { PlateItem, StockPlate, PlatePlanResult } from '../types/plate'
import type { Project, CuttingPlan } from '../types/project'

// ─── IMPORT ────────────────────────────────────────────────────

export interface ParseResult<T> {
  items: T[]
  warnings: string[]
}

function normalize(val: unknown): string {
  return String(val ?? '').trim().toLowerCase().replace(/[\s_-]/g, '')
}

export function parseSectionExcel(buffer: ArrayBuffer): {
  items: SectionItem[]
  stocks: StockBar[]
  warnings: string[]
} {
  const wb = XLSX.read(buffer, { type: 'array' })
  const warnings: string[] = []
  const items: SectionItem[] = []
  const stocks: StockBar[] = []

  // CutList sheet
  const cutSheet = wb.Sheets['CutList'] ?? wb.Sheets[wb.SheetNames[0]]
  if (!cutSheet) { warnings.push('No sheet found'); return { items, stocks, warnings } }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(cutSheet, { defval: '' })
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const keys = Object.keys(row).reduce((acc, k) => {
      acc[normalize(k)] = k
      return acc
    }, {} as Record<string, string>)

    const partName = String(row[keys['partname'] ?? ''] ?? '').trim()
    const length = Number(row[keys['lengthmm'] ?? keys['length'] ?? ''])
    const qty = Number(row[keys['quantity'] ?? keys['qty'] ?? ''])
    const profile = String(row[keys['profile'] ?? keys['section'] ?? ''] ?? '').trim()
    const mark = String(row[keys['mark'] ?? ''] ?? '').trim()

    if (!partName) continue
    if (isNaN(length) || length <= 0) { warnings.push(`Row ${i + 2}: invalid length "${length}"`); continue }
    if (isNaN(qty) || qty <= 0) { warnings.push(`Row ${i + 2}: invalid quantity "${qty}"`); continue }

    items.push({ id: uuidv4(), partName, profile, length: Math.round(length), quantity: Math.round(qty), mark })
  }

  // StockLengths sheet
  const stockSheet = wb.Sheets['StockLengths']
  if (stockSheet) {
    const stockRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(stockSheet, { defval: 0 })
    for (const row of stockRows) {
      const len = Number(Object.values(row)[0])
      const count = Number(Object.values(row)[1] ?? 0)
      if (!isNaN(len) && len > 0) {
        stocks.push({ id: uuidv4(), length: Math.round(len), count: Math.round(count) })
      }
    }
  }

  return { items, stocks, warnings }
}

export function parsePlateExcel(buffer: ArrayBuffer): {
  items: PlateItem[]
  stock: StockPlate | null
  warnings: string[]
} {
  const wb = XLSX.read(buffer, { type: 'array' })
  const warnings: string[] = []
  const items: PlateItem[] = []
  let stock: StockPlate | null = null

  const cutSheet = wb.Sheets['CutList'] ?? wb.Sheets[wb.SheetNames[0]]
  if (!cutSheet) { warnings.push('No sheet found'); return { items, stock, warnings } }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(cutSheet, { defval: '' })
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const keys = Object.keys(row).reduce((acc, k) => {
      acc[normalize(k)] = k
      return acc
    }, {} as Record<string, string>)

    const partName = String(row[keys['partname'] ?? ''] ?? '').trim()
    const width = Number(row[keys['widthmm'] ?? keys['width'] ?? ''])
    const height = Number(row[keys['heightmm'] ?? keys['height'] ?? ''])
    const qty = Number(row[keys['quantity'] ?? keys['qty'] ?? ''])
    const rotateVal = String(row[keys['canrotate'] ?? keys['rotate'] ?? ''] ?? 'yes').trim().toLowerCase()
    const canRotate = ['yes', 'y', 'true', '1'].includes(rotateVal)
    const mark = String(row[keys['mark'] ?? ''] ?? '').trim()
    const material = String(row[keys['material'] ?? ''] ?? '').trim()
    const thickness = Number(row[keys['thicknessmm'] ?? keys['thickness'] ?? ''] ?? 0)

    if (!partName) continue
    if (isNaN(width) || width <= 0) { warnings.push(`Row ${i + 2}: invalid width`); continue }
    if (isNaN(height) || height <= 0) { warnings.push(`Row ${i + 2}: invalid height`); continue }
    if (isNaN(qty) || qty <= 0) { warnings.push(`Row ${i + 2}: invalid quantity`); continue }

    items.push({ id: uuidv4(), partName, material, thickness, width: Math.round(width), height: Math.round(height), quantity: Math.round(qty), canRotate, mark })
  }

  const stockSheet = wb.Sheets['StockPlate']
  if (stockSheet) {
    const stockRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(stockSheet, { defval: 0 })
    if (stockRows.length > 0) {
      const vals = Object.values(stockRows[0]).map(Number)
      stock = { width: vals[0] ?? 2400, height: vals[1] ?? 1200, thickness: vals[2] ?? 10, count: 0 }
    }
  }

  return { items, stock, warnings }
}

// ─── EXPORT ────────────────────────────────────────────────────

const COLORS = {
  header: { fgColor: { rgb: '1E3A8A' } },
  subheader: { fgColor: { rgb: '3B82F6' } },
  waste: { fgColor: { rgb: 'FEF3C7' } },
  barSep: { fgColor: { rgb: 'F1F5F9' } },
}

function applyHeaderStyle(ws: XLSX.WorkSheet, range: string, bgRgb: string) {
  const ref = XLSX.utils.decode_range(range)
  for (let R = ref.s.r; R <= ref.e.r; R++) {
    for (let C = ref.s.c; C <= ref.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[addr]) ws[addr] = { t: 's', v: '' }
      ws[addr].s = {
        fill: { patternType: 'solid', fgColor: { rgb: bgRgb } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { bottom: { style: 'thin' } },
      }
    }
  }
}

export function exportSectionPlan(project: Project, plan: CuttingPlan): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const data = plan.sectionData!
  const result = data.result!

  // Sheet 1: Summary
  const summaryData = [
    ['SECTION STEEL CUTTING PLAN', ''],
    ['Project', project.name],
    ['Client', project.client],
    ['Engineer', project.engineer],
    ['Date', project.date],
    ['Revision', project.revision],
    ['Plan Name', plan.name],
    ['Notes', plan.notes || '-'],
    [''],
    ['OPTIMIZATION RESULTS', ''],
    ['Total Bars Used', result.totalBarsUsed],
    ['Total Waste (mm)', result.totalWasteMm.toFixed(0)],
    ['Overall Utilization', result.overallUtilizationPct.toFixed(1) + '%'],
    ['Kerf Width (mm)', data.kerf],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  summaryWs['!cols'] = [{ wch: 25 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // Sheet 2: Bar Cutting List
  const barRows: unknown[][] = [
    ['Bar No', 'Stock Length (mm)', 'Part Name', 'Profile', 'Mark', 'Cut Length (mm)', 'Kerf (mm)', 'Start Pos (mm)']
  ]
  for (const bar of result.bars) {
    for (const cut of bar.cuts) {
      barRows.push([bar.barIndex, bar.stockLength, cut.partName, cut.profile, cut.mark, cut.length, data.kerf, cut.startPos.toFixed(0)])
    }
    barRows.push([bar.barIndex, bar.stockLength, '— WASTE —', '', '', bar.wasteLength.toFixed(0), '', ''])
    barRows.push([''])
  }
  const barWs = XLSX.utils.aoa_to_sheet(barRows)
  barWs['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, barWs, 'BarCuttingList')

  // Sheet 3: Input
  const inputRows: unknown[][] = [['Part Name', 'Profile', 'Length (mm)', 'Quantity', 'Mark']]
  for (const item of data.items) {
    inputRows.push([item.partName, item.profile, item.length, item.quantity, item.mark])
  }
  const inputWs = XLSX.utils.aoa_to_sheet(inputRows)
  inputWs['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, inputWs, 'CutListInput')

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

export function exportPlatePlan(project: Project, plan: CuttingPlan): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const data = plan.plateData!
  const result = data.result!

  // Sheet 1: Summary
  const summaryData = [
    ['PLATE CUTTING PLAN', ''],
    ['Project', project.name],
    ['Client', project.client],
    ['Engineer', project.engineer],
    ['Date', project.date],
    ['Revision', project.revision],
    ['Plan Name', plan.name],
    ['Notes', plan.notes || '-'],
    [''],
    ['STOCK PLATE', ''],
    ['Width (mm)', data.stockPlate.width],
    ['Height (mm)', data.stockPlate.height],
    ['Thickness (mm)', data.stockPlate.thickness],
    [''],
    ['OPTIMIZATION RESULTS', ''],
    ['Total Plates Used', result.totalPlatesUsed],
    ['Total Waste Area (mm²)', result.totalWasteAreaMm2.toFixed(0)],
    ['Overall Utilization', result.overallUtilizationPct.toFixed(1) + '%'],
    ['Kerf Width (mm)', data.kerf],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  summaryWs['!cols'] = [{ wch: 25 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // Sheet 2: Plate Cutting List
  const plateRows: unknown[][] = [
    ['Plate No', 'Stock W (mm)', 'Stock H (mm)', 'Part Name', 'Mark', 'X (mm)', 'Y (mm)', 'Width (mm)', 'Height (mm)', 'Rotated', 'Utilization %']
  ]
  for (const plate of result.plates) {
    for (const p of plate.placements) {
      plateRows.push([
        plate.plateIndex, plate.stockWidth, plate.stockHeight,
        p.partName, p.mark,
        p.x.toFixed(0), p.y.toFixed(0),
        p.width.toFixed(0), p.height.toFixed(0),
        p.rotated ? 'Yes' : 'No', ''
      ])
    }
    plateRows.push([plate.plateIndex, '', '', '— SUMMARY —', '', '', '', '', '', '', plate.utilizationPct.toFixed(1) + '%'])
    plateRows.push([''])
  }
  const plateWs = XLSX.utils.aoa_to_sheet(plateRows)
  plateWs['!cols'] = Array(11).fill({ wch: 14 })
  XLSX.utils.book_append_sheet(wb, plateWs, 'PlateCuttingList')

  // Sheet 3: Input
  const inputRows: unknown[][] = [['Part Name', 'Material', 'Thickness', 'Width (mm)', 'Height (mm)', 'Quantity', 'Can Rotate', 'Mark']]
  for (const item of data.items) {
    inputRows.push([item.partName, item.material, item.thickness, item.width, item.height, item.quantity, item.canRotate ? 'Yes' : 'No', item.mark])
  }
  const inputWs = XLSX.utils.aoa_to_sheet(inputRows)
  inputWs['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, inputWs, 'CutListInput')

  // Suppress unused import warning
  void applyHeaderStyle; void COLORS

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

export function generateTemplate(type: 'section' | 'plate'): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  if (type === 'section') {
    const ws = XLSX.utils.aoa_to_sheet([
      ['PartName', 'Profile', 'Length_mm', 'Quantity', 'Mark'],
      ['Rafter', 'IPE 200', 5500, 4, 'R-01'],
      ['Column', 'HEA 160', 3200, 6, 'C-01'],
    ])
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'CutList')

    const stockWs = XLSX.utils.aoa_to_sheet([
      ['Length_mm', 'Count'],
      [6000, 0],
      [12000, 0],
    ])
    XLSX.utils.book_append_sheet(wb, stockWs, 'StockLengths')
  } else {
    const ws = XLSX.utils.aoa_to_sheet([
      ['PartName', 'Material', 'Thickness', 'Width_mm', 'Height_mm', 'Quantity', 'CanRotate', 'Mark'],
      ['Base Plate', 'A36', 10, 400, 300, 8, 'YES', 'BP-01'],
      ['Stiffener', 'S275', 8, 150, 600, 12, 'NO', 'ST-02'],
    ])
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'CutList')

    const stockWs = XLSX.utils.aoa_to_sheet([
      ['Width_mm', 'Height_mm', 'Thickness_mm'],
      [2400, 1200, 10],
    ])
    XLSX.utils.book_append_sheet(wb, stockWs, 'StockPlate')
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
