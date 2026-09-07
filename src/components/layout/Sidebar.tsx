import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Monitor, Settings2, FileText,
  Database, Wifi, Smartphone, Download, Ticket, BarChart3,
  Shield, ChevronLeft, ChevronRight, FlaskConical, HelpCircle,
  Laptop
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard',   label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/inventaire',  label: 'Inventaire',       icon: Package },
  { to: '/postes',      label: 'Poste / Fonction',  icon: Laptop },
  { to: '/resolutions', label: 'Résolutions',       icon: HelpCircle },
  { to: '/systeme',     label: 'Syst. exploitation',icon: Monitor },
  { to: '/office',      label: 'Microsoft Office',  icon: FileText },
  { to: '/campagnes',   label: 'Campagnes',          icon: Settings2 },
  { to: '/dual-sim',    label: 'Sites Dual-SIM',     icon: Wifi },
  { to: '/tsp',         label: 'Suivi TSP',          icon: Smartphone },
  { to: '/apk',         label: 'Déploiement APK',    icon: Download },
  { to: '/di-ds',       label: 'Suivi DI/DS',        icon: Ticket },
  { to: '/rapports',    label: 'États & Rapports',   icon: BarChart3 },
  { to: '/imports',     label: 'Importer des données', icon: Download, assistantOnly: true },
  { to: '/admin',       label: 'Administration',     icon: Shield, adminOnly: true },
]

interface Props {
  open: boolean
  collapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: Props) {
  const { isAdmin, isAssistant } = useAuth()
  const location = useLocation()

  const visible = navItems.filter(item => (!item.adminOnly || isAdmin) && (!item.assistantOnly || isAssistant))

  return (
    <aside className={cn(
      'fixed top-0 left-0 z-30 h-full bg-slate-950 text-white flex flex-col transition-all duration-300 shadow-2xl shadow-slate-950/20',
      collapsed ? 'w-16' : 'w-64',
      // Mobile : slide in/out
      open ? 'translate-x-0' : '-translate-x-full',
      'lg:translate-x-0'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-white/10 min-h-[72px]',
        collapsed && 'justify-center px-2'
      )}>
        <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-700 rounded-xl shadow-lg shadow-primary-900/40 flex items-center justify-center flex-shrink-0">
          <FlaskConical size={18} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold leading-tight">Le Labo de</p>
            <p className="text-xs text-primary-300 leading-tight">l'Assistant</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {visible.map(item => {
          const Icon = item.icon
          const active = location.pathname === item.to ||
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to))
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-white/14 text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Toggle collapse (desktop uniquement) */}
      <div className="border-t border-primary-800 p-2 hidden lg:block">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                     text-primary-300 hover:bg-primary-800 hover:text-white text-xs transition-colors"
          title={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <>
              <ChevronLeft size={16} />
              <span>Réduire</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
