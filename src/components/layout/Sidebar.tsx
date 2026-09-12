import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Monitor, Settings2, FileText,
  Wifi, Smartphone, Download, Ticket, BarChart3,
  Shield, ChevronLeft, ChevronRight, HelpCircle,
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
  { to: '/admin',       label: 'Administration',     icon: Shield, adminOnly: true },
]

interface Props {
  open: boolean
  collapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: Props) {
  const { isAdmin, appUser } = useAuth()
  const location = useLocation()

  const visible = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <aside className={cn(
      'fixed top-0 left-0 z-30 h-full bg-white flex flex-col transition-all duration-300',
      'shadow-soft',
      collapsed ? 'w-20' : 'w-64',
      open ? 'translate-x-0' : '-translate-x-full',
      'lg:translate-x-0'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-2.5 px-4 py-5', collapsed && 'justify-center px-2')}>
        <div className="w-9 h-9 rounded-xl bg-navy-900 flex items-center justify-center flex-shrink-0 text-white data-value text-[11px] font-extrabold">
          LDA
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-extrabold text-navy-900 leading-tight">Le Labo</p>
            <p className="text-[10px] text-slate leading-tight font-medium">de l'Assistant</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1 px-3 scrollbar-thin flex flex-col gap-1">
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
                'flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13.5px] font-semibold transition-all',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-navy-900 text-white shadow-pop'
                  : 'text-[#5B6180] hover:bg-canvas-a'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Utilisateur + toggle */}
      <div className="p-3 border-t border-gray-100">
        {!collapsed && appUser && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-info-50 text-info-700 flex items-center justify-center font-extrabold text-xs flex-shrink-0">
              {appUser.nom_complet?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-graphite truncate">{appUser.nom_complet}</p>
              <p className="text-[10px] text-slate truncate">{appUser.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="w-full hidden lg:flex items-center justify-center gap-2 py-2 px-3 rounded-2xl
                     text-slate hover:bg-canvas-a text-xs font-semibold transition-colors"
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
