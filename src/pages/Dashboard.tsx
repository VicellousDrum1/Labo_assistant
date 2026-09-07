import { useState, useEffect } from 'react'
import {
  Package, Monitor, FileText, Smartphone, Download,
  Wifi, Ticket, CheckCircle, AlertCircle, Clock,
  TrendingUp, Activity, BarChart3
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { KpiCard } from '@/components/ui/KpiCard'
import { PageLoader } from '@/components/ui/Spinner'

// ---- types ----
interface DashStats {
  // Inventaire
  total: number; actifs: number; desactives: number
  enService: number; enPanne: number; enReparation: number; renouveles: number
  // OS
  osMigres: number; osEnCours: number; osNonMigres: number
  // Office
  offMigres: number; offEnCours: number; offNonMigres: number
  // TSP
  tspTotal: number; tspActifs: number
  tspParSociete: { name: string; value: number }[]
  tspParOperateur: { name: string; value: number }[]
  // APK
  apkDeploye: number; apkNonDeploye: number; apkEnCours: number
  // DualSIM
  dsimTotal: number; dsimActifs: number
  dsimParOperateur: { name: string; value: number }[]
  // DI/DS
  didsOuverts: number; didsEnCours: number; didsClotures: number; didsCritiques: number
  // Types matériels
  parType: { name: string; value: number }[]
  parEtat: { name: string; value: number }[]
}

const COLORS = ['#1d4ed8', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#65a30d', '#dc2626']

const PIE_COLORS = {
  'Migré': '#16a34a',
  'En cours de migration': '#ea580c',
  'Non migré': '#dc2626',
  'Déployé': '#16a34a',
  'Non déployé': '#dc2626',
  'En cours': '#ea580c',
}

function StatPie({
  data, title, total
}: { data: { name: string; value: number }[]; title: string; total?: number }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {total !== undefined && (
        <p className="text-2xl font-bold text-gray-900 mb-2">{total}</p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
               dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={(PIE_COLORS as Record<string, string>)[entry.name] ?? COLORS[i % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [v, '']} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function ProgressBar({ label, value, max, color = 'bg-primary-600' }: {
  label: string; value: number; max: number; color?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold">{value} <span className="text-gray-400">/ {max}</span> — {pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Dashboard() {
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterSociete, setFilterSociete] = useState('')
  const [filterExploitation, setFilterExploitation] = useState('')
  const [societes, setSocietes] = useState<string[]>([])
  const [exploitations, setExploitations] = useState<string[]>([])

  useEffect(() => {
    loadRefs()
  }, [])

  useEffect(() => {
    loadStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSociete, filterExploitation])

  async function loadRefs() {
    const [{ data: socs }, { data: exps }] = await Promise.all([
      supabase.from('ref_societes').select('valeur').eq('actif', true).order('ordre'),
      supabase.from('ref_exploitations').select('valeur').eq('actif', true).order('ordre'),
    ])
    setSocietes(socs?.map(s => s.valeur) ?? [])
    setExploitations(exps?.map(e => e.valeur) ?? [])
  }

  async function loadStats() {
    setLoading(true)
    try {
      // Construire filtres
      let invQ = supabase.from('inventaire').select('*', { count: 'exact', head: false })
      if (filterSociete) invQ = invQ.eq('societe', filterSociete)
      if (filterExploitation) invQ = invQ.eq('exploitation', filterExploitation)

      const { data: inv } = await invQ

      const total      = inv?.length ?? 0
      const actifs     = inv?.filter(r => r.actif).length ?? 0
      const desactives = inv?.filter(r => !r.actif).length ?? 0
      const enService  = inv?.filter(r => r.actif && r.etat === 'En service').length ?? 0
      const enPanne    = inv?.filter(r => r.actif && r.etat === 'En panne').length ?? 0
      const enReparation = inv?.filter(r => r.actif && r.etat === 'En réparation').length ?? 0
      const renouveles = inv?.filter(r => r.actif && r.etat === 'Renouvelé').length ?? 0

      // Types
      const typeMap: Record<string, number> = {}
      inv?.filter(r => r.actif).forEach(r => {
        typeMap[r.type_materiel] = (typeMap[r.type_materiel] ?? 0) + 1
      })
      const parType = Object.entries(typeMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)

      // Etats
      const etatMap: Record<string, number> = {}
      inv?.filter(r => r.actif).forEach(r => {
        etatMap[r.etat] = (etatMap[r.etat] ?? 0) + 1
      })
      const parEtat = Object.entries(etatMap).map(([name, value]) => ({ name, value }))

      // IDs actifs pour jointures
      const actifIds = inv?.filter(r => r.actif).map(r => r.id_materiel) ?? []

      // OS
      const { data: os } = actifIds.length
        ? await supabase.from('systeme_exploitation').select('statut_systeme').in('id_materiel', actifIds)
        : { data: [] }
      const osMigres    = os?.filter(r => r.statut_systeme === 'Migré').length ?? 0
      const osEnCours   = os?.filter(r => r.statut_systeme === 'En cours de migration').length ?? 0
      const osNonMigres = os?.filter(r => r.statut_systeme === 'Non migré').length ?? 0

      // Office
      const { data: off } = actifIds.length
        ? await supabase.from('microsoft_office').select('statut_office').in('id_materiel', actifIds)
        : { data: [] }
      const offMigres    = off?.filter(r => r.statut_office === 'Migré').length ?? 0
      const offEnCours   = off?.filter(r => r.statut_office === 'En cours de migration').length ?? 0
      const offNonMigres = off?.filter(r => r.statut_office === 'Non migré').length ?? 0

      // TSP
      let tspQ = supabase.from('tsp').select('*')
      if (filterSociete) tspQ = tspQ.eq('societe_entite', filterSociete)
      if (filterExploitation) tspQ = tspQ.eq('exploitation', filterExploitation)
      const { data: tsp } = await tspQ
      const tspTotal  = tsp?.length ?? 0
      const tspActifs = tsp?.filter(r => r.actif).length ?? 0

      const tspSocMap: Record<string, number> = {}
      tsp?.filter(r => r.actif).forEach(r => {
        const k = r.societe_entite ?? 'Inconnu'
        tspSocMap[k] = (tspSocMap[k] ?? 0) + 1
      })
      const tspParSociete = Object.entries(tspSocMap).map(([name, value]) => ({ name, value }))

      const tspOpMap: Record<string, number> = {}
      tsp?.filter(r => r.actif).forEach(r => {
        const k = r.operateur ?? 'Inconnu'
        tspOpMap[k] = (tspOpMap[k] ?? 0) + 1
      })
      const tspParOperateur = Object.entries(tspOpMap).map(([name, value]) => ({ name, value }))

      // APK (via TSP IDs)
      const tspIds = tsp?.map(r => r.id_tsp) ?? []
      const { data: apk } = tspIds.length
        ? await supabase.from('deploiement_apk').select('statut_deploiement').in('id_tsp', tspIds)
        : { data: [] }
      const apkDeploye    = apk?.filter(r => r.statut_deploiement === 'Déployé').length ?? 0
      const apkNonDeploye = apk?.filter(r => r.statut_deploiement === 'Non déployé').length ?? 0
      const apkEnCours    = apk?.filter(r => r.statut_deploiement === 'En cours').length ?? 0

      // DualSIM
      let dsimQ = supabase.from('site_dualsim').select('*')
      if (filterSociete) dsimQ = dsimQ.eq('societe', filterSociete)
      const { data: dsim } = await dsimQ
      const dsimTotal  = dsim?.length ?? 0
      const dsimActifs = dsim?.filter(r => r.actif).length ?? 0
      const opMap: Record<string, number> = {}
      dsim?.filter(r => r.actif).forEach(r => {
        const ops = [r.operateur_sim1, r.operateur_sim2].filter(Boolean)
        ops.forEach(op => { opMap[op!] = (opMap[op!] ?? 0) + 1 })
      })
      const dsimParOperateur = Object.entries(opMap).map(([name, value]) => ({ name, value }))

      // DI/DS
      let didsQ = supabase.from('suivi_di_ds').select('statut, priorite')
      if (filterExploitation) didsQ = didsQ.eq('exploitation', filterExploitation)
      const { data: dids } = await didsQ
      const didsOuverts  = dids?.filter(r => r.statut === 'Nouveau' || r.statut === 'Affecté').length ?? 0
      const didsEnCours  = dids?.filter(r => r.statut === 'En cours' || r.statut === 'En attente').length ?? 0
      const didsClotures = dids?.filter(r => r.statut === 'Clôturé' || r.statut === 'Résolu').length ?? 0
      const didsCritiques = dids?.filter(r => r.priorite === 'Critique' && !['Clôturé','Annulé','Résolu'].includes(r.statut)).length ?? 0

      setStats({
        total, actifs, desactives,
        enService, enPanne, enReparation, renouveles,
        osMigres, osEnCours, osNonMigres,
        offMigres, offEnCours, offNonMigres,
        tspTotal, tspActifs, tspParSociete, tspParOperateur,
        apkDeploye, apkNonDeploye, apkEnCours,
        dsimTotal, dsimActifs, dsimParOperateur,
        didsOuverts, didsEnCours, didsClotures, didsCritiques,
        parType, parEtat,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading && !stats) return <PageLoader />

  const s = stats!

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête + filtres */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-primary-900 to-primary-700 p-6 sm:p-8 text-white shadow-xl shadow-primary-950/15">
        <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full border-[28px] border-white/10" />
        <div className="relative flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs font-semibold text-primary-100"><Activity size={13} /> Centre de pilotage</div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">Tableau de bord</h1>
            <p className="mt-2 text-sm text-primary-100/80">Une vue instantanée sur l’état du parc et les priorités opérationnelles.</p>
          </div>
          <div className="flex gap-2 flex-wrap rounded-2xl bg-white/10 border border-white/10 p-2 backdrop-blur-sm">
          <select
            value={filterSociete}
            onChange={e => setFilterSociete(e.target.value)}
            className="input text-sm w-40 bg-white/95"
          >
            <option value="">Toutes sociétés</option>
            {societes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterExploitation}
            onChange={e => setFilterExploitation(e.target.value)}
            className="input text-sm w-44 bg-white/95"
          >
            <option value="">Toutes exploitations</option>
            {exploitations.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {(filterSociete || filterExploitation) && (
            <button
              onClick={() => { setFilterSociete(''); setFilterExploitation('') }}
              className="btn-secondary text-sm bg-white/95"
            >
              Réinitialiser
            </button>
          )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center text-sm text-gray-400 py-2 animate-pulse">
          Actualisation…
        </div>
      )}

      {/* ── PARC INFORMATIQUE ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Package size={14} /> Parc informatique
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard label="Total matériels"   value={s.total}       icon={Package}     color="blue" />
          <KpiCard label="Actifs"            value={s.actifs}      icon={CheckCircle} color="green" />
          <KpiCard label="Désactivés"        value={s.desactives}  icon={AlertCircle} color="gray" />
          <KpiCard label="En service"        value={s.enService}   icon={Activity}    color="green" />
          <KpiCard label="En panne"          value={s.enPanne}     icon={AlertCircle} color="red" />
          <KpiCard label="En réparation"     value={s.enReparation} icon={Clock}      color="orange" />
          <KpiCard label="Renouvelés"        value={s.renouveles}  icon={TrendingUp}  color="purple" />
        </div>
      </section>

      {/* ── GRAPHIQUES INVENTAIRE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Répartition par type */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition par type de matériel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.parType} margin={{ top: 4, right: 10, left: -10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Quantité" radius={[4, 4, 0, 0]}>
                {s.parType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition par état */}
        <StatPie data={s.parEtat} title="Répartition par état" />
      </div>

      {/* ── MIGRATIONS ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Monitor size={14} /> Migrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OS */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Monitor size={15} /> Systèmes d'exploitation
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-green-50 rounded-xl">
                <p className="text-xl font-bold text-green-700">{s.osMigres}</p>
                <p className="text-xs text-gray-500 mt-0.5">Migrés</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <p className="text-xl font-bold text-orange-700">{s.osEnCours}</p>
                <p className="text-xs text-gray-500 mt-0.5">En cours</p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <p className="text-xl font-bold text-red-700">{s.osNonMigres}</p>
                <p className="text-xs text-gray-500 mt-0.5">Non migrés</p>
              </div>
            </div>
            <ProgressBar
              label="Progression migration OS"
              value={s.osMigres}
              max={s.osMigres + s.osEnCours + s.osNonMigres}
              color="bg-green-500"
            />
          </div>

          {/* Office */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText size={15} /> Microsoft Office
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-green-50 rounded-xl">
                <p className="text-xl font-bold text-green-700">{s.offMigres}</p>
                <p className="text-xs text-gray-500 mt-0.5">Migrés</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <p className="text-xl font-bold text-orange-700">{s.offEnCours}</p>
                <p className="text-xs text-gray-500 mt-0.5">En cours</p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <p className="text-xl font-bold text-red-700">{s.offNonMigres}</p>
                <p className="text-xs text-gray-500 mt-0.5">Non migrés</p>
              </div>
            </div>
            <ProgressBar
              label="Progression migration Office"
              value={s.offMigres}
              max={s.offMigres + s.offEnCours + s.offNonMigres}
              color="bg-blue-500"
            />
          </div>
        </div>
      </section>

      {/* ── TSP + APK ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Smartphone size={14} /> Mobilité
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiCard label="TSP total"     value={s.tspTotal}      icon={Smartphone} color="blue" />
          <KpiCard label="TSP actifs"    value={s.tspActifs}     icon={CheckCircle} color="green" />
          <KpiCard label="APK déployés"  value={s.apkDeploye}    icon={Download}   color="green" />
          <KpiCard label="APK non dépl." value={s.apkNonDeploye} icon={AlertCircle} color="red" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatPie
            data={[
              { name: 'Déployé', value: s.apkDeploye },
              { name: 'Non déployé', value: s.apkNonDeploye },
              { name: 'En cours', value: s.apkEnCours },
            ].filter(d => d.value > 0)}
            title="Déploiement APK"
          />
          <StatPie data={s.tspParOperateur} title="TSP par opérateur" />
          <StatPie data={s.tspParSociete}   title="TSP par société" />
        </div>
      </section>

      {/* ── DUAL-SIM ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Wifi size={14} /> Dual-SIM
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Sites total"  value={s.dsimTotal}  icon={Wifi}        color="blue" />
            <KpiCard label="Sites actifs" value={s.dsimActifs} icon={CheckCircle} color="green" />
          </div>
          <div className="lg:col-span-2">
            <StatPie data={s.dsimParOperateur} title="Répartition par opérateur" />
          </div>
        </div>
      </section>

      {/* ── DI/DS ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Ticket size={14} /> Support DI/DS
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Demandes ouvertes" value={s.didsOuverts}   icon={Ticket}       color="blue" />
          <KpiCard label="En cours"          value={s.didsEnCours}   icon={Clock}        color="orange" />
          <KpiCard label="Clôturées"         value={s.didsClotures}  icon={CheckCircle}  color="green" />
          <KpiCard label="Critiques actives" value={s.didsCritiques} icon={AlertCircle}  color="red" />
        </div>
      </section>
    </div>
  )
}
