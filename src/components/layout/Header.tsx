import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

  return (
    <>
      <header className="sticky top-0 z-10 h-[72px] bg-canvas-b flex items-center px-6 gap-3">
        {/* Hamburger mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden btn-icon bg-white shadow-softer"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        {/* Toggle collapse desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex btn-icon bg-white shadow-softer"
          aria-label="Basculer le menu"
          title={sidebarCollapsed ? 'Ouvrir la barre latérale' : 'Réduire la barre latérale'}
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {/* Recherche globale */}
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white shadow-softer',
            'text-sm text-slate hover:shadow-soft transition-shadow',
            'flex-1 max-w-sm text-left'
          )}
        >
          <Search size={15} />
          <span>Rechercher…</span>
          <span className="ml-auto hidden sm:inline text-xs bg-canvas-a px-1.5 py-0.5 rounded-lg data-value">Ctrl K</span>
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {/* Notifications placeholder */}
          <button className="btn-icon bg-white shadow-softer relative" aria-label="Notifications">
            <Bell size={18} />
          </button>

          {/* Menu utilisateur */}
          <div ref={dropRef} className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white shadow-softer
                         hover:shadow-soft transition-shadow text-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-navy-900 flex items-center justify-center text-white text-xs font-bold">
                {appUser?.nom_complet?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <span className="hidden sm:block font-semibold text-graphite max-w-[120px] truncate">
                {appUser?.nom_complet ?? appUser?.email}
              </span>
              <ChevronDown size={14} className="text-slate" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl
                              shadow-soft py-1.5 z-50 animate-fade-in overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-bold text-graphite truncate">{appUser?.nom_complet}</p>
                  <p className="text-xs text-slate truncate">{appUser?.email}</p>
                  <span className="mt-1.5 inline-block badge badge-signal">
                    {roleLabels[appUser?.role ?? ''] ?? appUser?.role}
                  </span>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/admin') }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-graphite font-medium
                             hover:bg-canvas-a transition-colors"
                >
                  <User size={15} />
                  Mon profil
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-danger-700 font-medium
                             hover:bg-danger-50 transition-colors"
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
