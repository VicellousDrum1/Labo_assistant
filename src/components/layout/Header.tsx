import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Search, LogOut, User, ChevronDown, Bell, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { GlobalSearch } from '@/components/GlobalSearch'
import { cn } from '@/lib/utils'

interface Props {
  onMenuClick: () => void
  onToggleCollapse: () => void
  sidebarCollapsed: boolean
}

export function Header({ onMenuClick, onToggleCollapse, sidebarCollapsed }: Props) {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Fermer dropdown en cliquant ailleurs
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // Raccourci clavier Ctrl+K pour la recherche
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const roleLabels: Record<string, string> = {
    administrateur: 'Administrateur',
    assistant: 'Assistant',
    consultation: 'Consultation',
  }
  const pageLabels: Record<string, string> = {
    '/dashboard': 'Vue d’ensemble', '/inventaire': 'Gestion du parc', '/postes': 'Postes et fonctions',
    '/systeme': 'Migrations système', '/office': 'Microsoft Office', '/campagnes': 'Campagnes',
    '/resolutions': 'Base de connaissances', '/dual-sim': 'Connectivité Dual-SIM', '/tsp': 'Terminaux TSP',
    '/apk': 'Déploiement APK', '/di-ds': 'Centre de support', '/rapports': 'Rapports', '/admin': 'Administration',
  }
  const currentPage = pageLabels[location.pathname] ?? 'Espace de travail'

  return (
    <>
      <header className="sticky top-0 z-10 h-[76px] bg-white/90 backdrop-blur-xl border-b border-slate-200/80 flex items-center px-4 sm:px-7 gap-3">
        {/* Hamburger mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden btn-icon text-gray-600"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        <div className="hidden xl:block border-l border-slate-200 pl-4 leading-tight">
          <p className="text-[10px] uppercase tracking-[.16em] font-bold text-slate-400">Espace opérationnel</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{currentPage}</p>
        </div>

        {/* Toggle collapse desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex btn-icon text-gray-500"
          aria-label="Basculer le menu"
          title={sidebarCollapsed ? 'Ouvrir la barre latérale' : 'Réduire la barre latérale'}
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {/* Recherche globale */}
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200',
            'text-sm text-slate-400 bg-slate-50/80 hover:bg-white hover:border-primary-200 hover:shadow-sm transition-all',
            'flex-1 max-w-md text-left'
          )}
        >
          <Search size={15} />
          <span>Rechercher…</span>
          <span className="ml-auto hidden sm:inline text-xs bg-gray-200 px-1.5 py-0.5 rounded font-mono">Ctrl K</span>
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {/* Notifications placeholder */}
          <button className="btn-icon relative hover:bg-primary-50 hover:text-primary-700" aria-label="Notifications">
            <Bell size={18} />
          </button>

          {/* Menu utilisateur */}
          <div ref={dropRef} className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100
                         transition-colors text-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-800 shadow-sm flex items-center justify-center text-white text-xs font-bold">
                {appUser?.nom_complet?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <span className="hidden sm:block font-medium text-gray-700 max-w-[120px] truncate">
                {appUser?.nom_complet ?? appUser?.email}
              </span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-gray-200
                              shadow-lg py-1 z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{appUser?.nom_complet}</p>
                  <p className="text-xs text-gray-500 truncate">{appUser?.email}</p>
                  <span className="mt-1 inline-block badge bg-primary-100 text-primary-800">
                    {roleLabels[appUser?.role ?? ''] ?? appUser?.role}
                  </span>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/admin') }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700
                             hover:bg-gray-50 transition-colors"
                >
                  <User size={15} />
                  Mon profil
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600
                             hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal recherche globale */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </>
  )
}
