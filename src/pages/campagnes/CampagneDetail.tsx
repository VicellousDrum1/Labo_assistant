import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, BarChart3 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { supabase, logAudit } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Campagne, SuiviCampagne, Inventaire } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { exportToExcel, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type SuiviWithInv = SuiviCampagne & { inventaire: Inventaire }
type InvPick = Pick<Inventaire, 'id_materiel' | 'numero_inventaire' | 'marque_modele' | 'utilisateur'>

const STATUTS = ['Non démarré', 'Planifié', 'En cours', 'Terminé', 'Échec', 'Non éligible']
const PIE_COLORS = ['#94a3b8', '#3b82f6', '#ea580c', '#16a34a', '#dc2626', '#e2e8f0']

export function CampagneDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAssistant } = useAuth()
  const [campagne, setCampagne] = useState<Campagne | null>(null)
  const [suivis, setSuivis] = useState<SuiviWithInv[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SuiviWithInv | null>(null)
  const [editStatut, setEditStatut] = useState('Non démarré')
  const [editObs, setEditObs] = useState('')
  const [addMaterielId, setAddMaterielId] = useState('')
  const [availableMat, setAvailableMat] = useState<InvPick[]>([])

  useEffect(() => {
    if (id) {
      supabase.from('campagnes').select('*').eq('id_campagne', id).single()
        .then(({ data }) => { if (data) setCampagne(data); else navigate('/campagnes') })
    }
  }, [id, navigate])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('suivi_campagne')
      .select(`*, inventaire:inventaire(id_materiel,numero_inventaire,marque_modele,utilisateur,societe,exploitation)`, { count: 'exact' })
      .eq('id_campagne', id)
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (filterStatut) q = q.eq('statut', filterStatut)
    const { data, count } = await q
    let rows = (data as SuiviWithInv[]) ?? []
    if (search.trim()) {
      const s = search.toLowerCase()
      rows = rows.filter(r =>
        r.inventaire?.numero_inventaire?.toLowerCase().includes(s) ||
        r.inventaire?.utilisateur?.toLowerCase().includes(s)
      )
    }
    setSuivis(rows)
    setTotal(search.trim() ? rows.length : (count ?? 0))
    setLoading(false)
  }, [id, page, pageSize, search, filterStatut])

  useEffect(() => { load() }, [load])

  async function loadAvailable() {
    if (!id) return
    const { data: existing } = await supabase.from('suivi_campagne').select('id_materiel').eq('id_campagne', id)
    const ids = existing?.map(r => r.id_materiel) ?? []
    let q = supabase.from('inventaire').select('id_materiel,numero_inventaire,marque_modele,utilisateur').eq('actif', true).order('numero_inventaire')
    if (ids.length) q = q.not('id_materiel', 'in', `(${ids.map(i => `"${i}"`).join(',')})`)
    const { data } = await q
    setAvailableMat(data ?? [])
  }

  async function handleSave() {
    if (!id) return
    try {
      if (editing) {
        await supabase.from('suivi_campagne').update({
          statut: editStatut, observation: editObs,
          date_traitement: new Date().toISOString(),
        }).eq('id_suivi', editing.id_suivi)
        await logAudit({ action: 'MODIFICATION', table_concernee: 'suivi_campagne', id_enregistrement: editing.id_suivi, nouvelles_valeurs: { statut: editStatut, observation: editObs } })
        toast.success('Suivi mis à jour')
      } else {
        if (!addMaterielId) { toast.error('Sélectionner un matériel'); return }
        const { data: created } = await supabase.from('suivi_campagne').insert({
          id_campagne: id, id_materiel: addMaterielId, statut: editStatut, observation: editObs,
        }).select().single()
        if (created) await logAudit({ action: 'CREATION', table_concernee: 'suivi_campagne', id_enregistrement: created.id_suivi, nouvelles_valeurs: { id_campagne: id, id_materiel: addMaterielId, statut: editStatut } })
        toast.success('Équipement ajouté à la campagne')
      }
      setModalOpen(false); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  // Statistiques
  const statsMap: Record<string, number> = {}
  STATUTS.forEach(s => { statsMap[s] = 0 })
  suivis.forEach(r => { statsMap[r.statut] = (statsMap[r.statut] ?? 0) + 1 })
  const pieData = STATUTS.map(s => ({ name: s, value: statsMap[s] })).filter(d => d.value > 0)
  const pctTermine = total > 0 ? Math.round((statsMap['Terminé'] / total) * 100) : 0

  const columns: Column<SuiviWithInv>[] = [
    { key: 'numero_inventaire', header: 'N° Inventaire', render: r => <span className="font-mono text-xs text-primary-700 font-semibold">{r.inventaire?.numero_inventaire ?? '—'}</span> },
    { key: 'marque_modele', header: 'Modèle', render: r => r.inventaire?.marque_modele ?? '—' },
    { key: 'utilisateur', header: 'Utilisateur', render: r => r.inventaire?.utilisateur ?? '—' },
    { key: 'exploitation', header: 'Exploitation', render: r => r.inventaire?.exploitation ?? '—' },
    { key: 'statut', header: 'Statut', render: r => <Badge value={r.statut} /> },
    { key: 'date_traitement', header: 'Traité le', render: r => <span className="text-xs text-gray-500">{formatDate(r.date_traitement)}</span> },
    { key: 'observation', header: 'Observation', render: r => <span className="text-xs text-gray-500 truncate max-w-xs block">{r.observation ?? '—'}</span> },
    { key: 'actions', header: '', className: 'w-12 text-right',
      render: r => isAssistant ? (
        <button onClick={() => { setEditing(r); setEditStatut(r.statut); setEditObs(r.observation ?? ''); setModalOpen(true) }} className="btn-icon"><Pencil size={14} /></button>
      ) : null
    },
  ]

  if (!campagne) return <PageLoader />

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <button onClick={() => navigate('/campagnes')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1"><ArrowLeft size={14} /> Campagnes</button>
          <h1 className="page-title flex items-center gap-2"><BarChart3 size={20} className="text-primary-700" />{campagne.nom}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge value={campagne.statut} />
            {campagne.type_campagne && <span className="text-xs text-gray-500">{campagne.type_campagne}</span>}
            {campagne.date_debut && <span className="text-xs text-gray-500">Du {formatDate(campagne.date_debut)} au {formatDate(campagne.date_fin_prevue)}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(suivis.map(r => ({ 'N° Inv': r.inventaire?.numero_inventaire ?? '', 'Utilisateur': r.inventaire?.utilisateur ?? '', 'Exploitation': r.inventaire?.exploitation ?? '', 'Statut': r.statut, 'Observation': r.observation ?? '', 'Traité le': formatDate(r.date_traitement) })), `campagne_${campagne.nom.toLowerCase().replace(/\s+/g, '_')}`)} className="btn-secondary text-sm">Exporter</button>
          {isAssistant && <button onClick={() => { setEditing(null); setEditStatut('Non démarré'); setEditObs(''); setAddMaterielId(''); loadAvailable(); setModalOpen(true) }} className="btn-primary text-sm gap-1.5"><Plus size={14} />Ajouter équipement</button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Avancement</h3>
          <div className="flex items-center justify-center mb-3">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="transform -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#16a34a" strokeWidth="3" strokeDasharray={`${pctTermine}, 100`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-800">{pctTermine}%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500">{statsMap['Terminé']} / {total} équipements terminés</p>
        </div>
        <div className="lg:col-span-2 card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Répartition</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="N° inventaire, utilisateur…" className="flex-1 min-w-48" />
        <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1) }} className="input text-sm w-44">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={suivis} loading={loading} rowKey={r => r.id_suivi} />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Modifier — ${editing.inventaire?.numero_inventaire}` : 'Ajouter un équipement'}
        footer={<><button onClick={() => setModalOpen(false)} className="btn-secondary">Annuler</button><button onClick={handleSave} className="btn-primary">Enregistrer</button></>}>
        <div className="space-y-4">
          {!editing && (
            <div>
              <label className="label label-required">Matériel</label>
              <select className="input" value={addMaterielId} onChange={e => setAddMaterielId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {availableMat.map(m => <option key={m.id_materiel} value={m.id_materiel}>{m.numero_inventaire} — {m.marque_modele} ({m.utilisateur ?? '—'})</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label label-required">Statut</label>
            <select className="input" value={editStatut} onChange={e => setEditStatut(e.target.value)}>
              {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Observation</label>
            <textarea rows={3} className="input resize-none" value={editObs} onChange={e => setEditObs(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
