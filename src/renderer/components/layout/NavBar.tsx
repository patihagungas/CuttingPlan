import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Projects', icon: '🗂' },
]

export function NavBar() {
  return (
    <aside className="w-56 bg-slate-900 text-white flex flex-col h-screen flex-shrink-0">
      <div className="px-5 py-4 border-b border-slate-700">
        <div className="text-xs text-slate-400 uppercase tracking-widest">TFe Group</div>
        <div className="text-lg font-bold text-white mt-0.5">CuttingPlan</div>
        <div className="text-xs text-slate-400 mt-0.5">v1.0.0</div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500">
        Steel Cutting Optimizer
      </div>
    </aside>
  )
}
