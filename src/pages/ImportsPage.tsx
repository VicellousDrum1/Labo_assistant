import { Link } from 'react-router-dom'
import { Database, Package, Smartphone, Wifi, Ticket, ArrowRight, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const modules = [
  { to: '/inventaire', title: 'Inventaire', description: 'Matériels, affectations, états et localisations.', icon: Package, tone: 'bg-blue-50 text-blue-700' },
  { to: '/tsp', title: 'Suivi TSP', description: 'Terminaux, agents, puces et opérateurs.', icon: Smartphone, tone: 'bg-violet-50 text-violet-700' },
  { to: '/dual-sim', title: 'Sites Dual-SIM', description: 'Routeurs, sites et cartes SIM.', icon: Wifi, tone: 'bg-cyan-50 text-cyan-700' },
  { to: '/di-ds', title: 'Demandes DI / DS', description: 'Demandes d’intervention et de service.', icon: Ticket, tone: 'bg-orange-50 text-orange-700' },
]

export function ImportsPage() {
  const { isAssistant } = useAuth()

  if (!isAssistant) return (
    <div className="max-w-2xl mx-auto mt-12 card p-10 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><ShieldAlert size={27} /></div>
      <h1 className="mt-5 text-xl font-bold text-slate-900">Import réservé aux contributeurs</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">Votre rôle actuel permet la consultation des données. Demandez à un administrateur de vous attribuer le rôle <strong>Assistant</strong> ou <strong>Administrateur</strong> pour importer des fichiers.</p>
    </div>
  )

  return (
    <div className="space-y-7 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-primary-900 to-primary-700 p-7 sm:p-9 text-white">
        <div className="absolute -right-12 -bottom-20 w-64 h-64 rounded-full border-[32px] border-white/10" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold"><Database size={13} /> Données de production</div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Importer vos bases existantes</h1>
          <p className="mt-2 text-sm leading-relaxed text-primary-100/85">Choisissez un module, téléchargez le modèle si nécessaire, puis contrôlez l’aperçu avant l’enregistrement.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map(module => {
          const Icon = module.icon
          return <Link key={module.to} to={module.to} className="group card p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary-200">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${module.tone}`}><Icon size={21} /></div>
            <h2 className="mt-5 text-lg font-bold text-slate-800">{module.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{module.description}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">Ouvrir et importer <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
          </Link>
        })}
      </div>
      <p className="text-center text-xs text-slate-400">Formats acceptés : Excel (.xlsx, .xls) et CSV. Les lignes invalides sont signalées avant l’import.</p>
    </div>
  )
}
