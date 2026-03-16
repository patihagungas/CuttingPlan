# CuttingPlan

A desktop application for steel cutting optimization, supporting both 1D section steel and 2D plate nesting.

## Features

### Section Steel (1D)
- Optimize bar, beam, and channel cuts from standard stock lengths (6m, 12m, or custom)
- First Fit Decreasing (FFD) bin-packing algorithm
- Configurable kerf (blade width) between cuts
- Visual bar diagrams showing cut layout per stock bar
- Waste percentage per bar

### Plate Cutting (2D)
- Guillotine-cut nesting optimization for rectangular steel plates
- Rotation support to maximize material usage
- Visual canvas showing piece placement on each plate
- NC1 file import — reads actual piece contours (AK section) and bolt holes (BO section)
- Bounding box optimization from contour data

### Project Management
- Create and manage multiple projects
- Project fields: name, client, engineer, date, revision, notes
- All data stored locally — no internet required

### Import / Export
- **Excel import**: Upload cut lists and stock lengths via `.xlsx` files
- **NC1 import**: Import steel pieces directly from DSTV/NC1 files (`.nc1`)
- **Excel export**: 3-sheet workbook — Summary, Cutting List, Input Data
- **Template download**: Blank Excel templates for section and plate input

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 31 |
| Frontend | React 18 + TypeScript |
| Build tool | electron-vite 2 |
| Styling | Tailwind CSS |
| 2D Canvas | Konva.js / react-konva |
| Storage | electron-store (local JSON) |
| Excel | xlsx (SheetJS) |
| Routing | react-router-dom (HashRouter) |

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install dependencies
```bash
npm install
```

### Run in development
```bash
npm run dev
```

### Build for production
```bash
npm run build
```

### Package as Windows installer
```bash
npm run dist
```
The installer will be output to the `release/` folder.

## NC1 File Format

The app supports DSTV NC1 files. Each piece block is parsed for:
- **Header**: piece mark, assembly, steel grade, profile type, quantity
- **Data block**: length, width, thickness, weight
- **AK section**: contour polygon points (used for shape display)
- **BO section**: bolt hole positions and diameters

Profile types starting with `PL` or `FL` are treated as plates; all others (IPE, HEA, HEB, UB, UC, etc.) are treated as section steel.

## Project Structure

```
src/
  main/           Electron main process (IPC handlers, store)
  preload/        Context bridge (exposes electronAPI to renderer)
  renderer/
    algorithms/   FFD (1D) and Guillotine Cut (2D) algorithms
    components/   UI components (canvas, cut list editors, diagrams)
    context/      Project state management
    pages/        Home, ProjectDetail, SectionPlan, PlatePlan
    services/     Excel, NC1, and store services
    types/        TypeScript interfaces (project, section, plate)
```

## License

To whoever want to use it. please use it wisely. i dont take full credit for this one. i just want to enjoy my work.
Thanks 

You can give the Credit to yourself XD 
