import { Component, type ReactNode } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { NavBar } from './components/layout/NavBar'
import { ProjectProvider } from './context/ProjectContext'
import { HomePage } from './pages/HomePage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { SectionPlanPage } from './pages/SectionPlanPage'
import { PlatePlanPage } from './pages/PlatePlanPage'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <div className="text-xl font-bold mb-2">Something went wrong</div>
            <div className="text-sm text-slate-400 mb-4 font-mono bg-slate-800 p-3 rounded text-left">
              {this.state.error.message}
            </div>
            <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ProjectProvider>
          <div className="flex h-screen overflow-hidden bg-slate-50">
            <NavBar />
            <main className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/project/:id" element={<ProjectDetailPage />} />
                <Route path="/project/:id/section/:planId" element={<SectionPlanPage />} />
                <Route path="/project/:id/plate/:planId" element={<PlatePlanPage />} />
              </Routes>
            </main>
          </div>
        </ProjectProvider>
      </HashRouter>
    </ErrorBoundary>
  )
}
