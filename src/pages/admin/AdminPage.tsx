import { useState } from 'react'
import { Shield, Users, List, History } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { UsersPanel } from './UsersPanel'
import { ReferentielsPanel } from './ReferentielsPanel'
import { AuditPanel } from './AuditPanel'

type Tab = 'utilisateurs' | 'referentiels' | 'audit'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'utilisateurs',  label: 'Utilisateurs',  icon: Users },
  { id: 'referentiels',  label: 'Référentiels',   icon: List },
  { id: 'audit',         label: 'Journal d\'audit', icon: History },
]

export function AdminPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('utilisateurs')

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield size={48} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-500">Accès réservé aux administrateurs</h2>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield size={22} className="text-primary-700" /> Administration
          </h1>
          <p className="page-subtitle">Gestion des utilisateurs, référentiels et audit</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'utilisateurs'  && <UsersPanel />}
      {tab === 'referentiels'  && <ReferentielsPanel />}
      {tab === 'audit'         && <AuditPanel />}
    </div>
  )
}
