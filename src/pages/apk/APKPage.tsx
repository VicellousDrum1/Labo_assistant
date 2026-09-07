import { useState, useEffect, useCallback } from 'react'
import { Download, Pencil, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { DeploiementApk, TSP } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { exportToExcel, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type ApkWithTsp = DeploiementApk & { tsp: TSP }
const STATUTS = ['Non déployé', 'En cours', 'Déployé']

interface FormData { statut_deploiement: string; observation: string }

export function APKPage() {
  const { isAssistant, user } = useAuth()
  const [data, setData] = useState<ApkWithTsp[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ApkWithTsp | null>(null)
  const [addTspId, setAddTspId] = useState('')
  const [tspList, setTspList] = useState<TSP[]>([])
  const { register, handleSubmit, reset } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('deploiement_apk')
      .select(`*, tsp:tsp(id_tsp,nom_prenoms,matricule,societe_entite,exploitation,operateur)`, { count: 'exact' })
      .order('updated_at', { ascending: false }).range(from, from + pageSize - 1)
    if (filterStatut) q = q.eq('statut_deploiement', filterStatut)
    const { data, count } = await q
    let rows = (data as ApkWithTsp[]) ?? []
    if (search.trim()) {
      const s = search.toLowerCase()
      rows = rows.filter(r => r.tsp?.nom_prenoms?.toLowerCase().includes(s) || r.tsp?.matricule?.toLowerCase().includes(s))
    }
    setData(rows); setTotal(search.trim() ? rows.length : (count ?? 0)); setLoading(false)
  }, [page, pageSize, search, filterStatut])

  useEffect(() => { load() }, [load])

  async function loadTSP() {
    const { data: existing } = await supabase.from('deploiement_apk').select('id_tsp')
    const ids = existing?.map(r => r.id_tsp) ?? []
    let q = supabase.from('tsp').select('*').eq('actif', true).order('nom_prenoms')
    if (ids.length) q = q.not('id_tsp', 'in', `(${ids.map(i => `"${i}"`).join(',')})`)
    const { data } = await q
    setTspList((data as TSP[]) ?? [])
  }

  async function onSubmit(form: FormData) {
    try {
      if (editing) {
        await supabase.from('deploiement_apk').update({
          statut_deploiement: form.statut_deploiement, observation: form.observation,
          date_deploiement: form.statut_deploiement === 'Déployé' ? new Date().toISOString() : null,
          deployed_by: user?.id,
        }).eq('id_deploiement', editing.id_deploiement)
        await logAudit({ action: 'MODIFICATION', table_concernee: 'deploiement_apk', id_enregistrement: editing.id_deploiement, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Déploiement mis à jour')
      } else {
        if (!addTspId) { toast.error('Sélectionner un TSP'); return }
        const { data: created } = await supabase.from('deploiement_apk').insert({
          id_tsp: addTspId, statut_deploiement: form.statut_deploiement, observation: form.observation,
          deployed_by: user?.id,
          date_deploiement: form.statut_deploiement === 'Déployé' ? new Date().toISOString() : null,
        }).select().single()
        if (created) await logAudit({ action: 'CREATION', table_concernee: 'deploiement_apk', id_enregistrement: created.id_deploiement, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Déploiement enregistré')
      }
      setModalOpen(false); reset(); setAddTspId(''); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  // Stats rapides
  const statMap: Record<string, number> = {}
  STATUTS.forEach(s => { statMap[s] = 0 })
  data.forEach(r => { statMap[r.statut_deploiement] = (statMap[r.statut_deploiement] ?? 0) + 1 })
  const pct = total > 0 ? Math.round((statMap['Déployé'] / total) * 100) : 0

  const columns: Column<ApkWithTsp>[] = [
    { key: 'nom', header: 'TSP', render: r => <span className="font-medium">{r.tsp?.nom_prenoms}</span> },
    { key: 'matricule', header: 'Matricule', render: r => <code className="text-xs">{r.tsp?.matricule ?? '—'}</code> },
    { key: 'societe', header: 'Société', render: r => r.tsp?.societe_entite ?? '—' },
    { key: 'exploitation', header: 'Exploitation', render: r => r.tsp?.exploitation ?? '—' },
    { key: 'operateur', header: 'Opérateur', render: r => r.tsp?.operateur ?? '—' },
    { key: 'statut_deploiement', header: 'Statut APK', render: r => <Badge value={r.statut_deploiement} /> },
    { key: 'date_deploiement', header: 'Date déploiement', render: r => <span className="text-xs text-gray-500">{formatDate(r.date_deploiement)}</span> },
    { key: 'actions', header: '', className: 'w-12 text-right',
      render: r => isAssistant ? <button onClick={() => { setEditing(r); reset({ statut_deploiement: r.statut_deploiement, observation: r.observation ?? '' }); setModalOpen(true) }} className="btn-icon"><Pencil size={14} /></button> : null },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Download size={20} className="text-primary-700" />Déploiement APK</h1>
          <p className="page-subtitle">{total} TSP · {pct}% déployés</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(data.map(r => ({ 'TSP': r.tsp?.nom_prenoms, 'Matricule': r.tsp?.matricule ?? '', 'Société': r.tsp?.societe_entite ?? '', 'Exploitation': r.tsp?.exploitation ?? '', 'Statut': r.statut_deploiement, 'Date': formatDate(r.date_deploiement) })), 'deploiement_apk')} className="btn-secondary text-sm">Exporter</button>
          {isAssistant && <button onClick={() => { setEditing(null); reset({ statut_deploiement: 'Non déployé', observation: '' }); loadTSP(); setAddTspId(''); setModalOpen(true) }} className="btn-primary text-sm gap-1.5"><Plus size={14} />Ajouter</button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Déployés', v: statMap['Déployé'], c: 'bg-green-50 text-green-700' }, { l: 'Non déployés', v: statMap['Non déployé'], c: 'bg-red-50 text-red-700' }, { l: 'En cours', v: statMap['En cours'], c: 'bg-orange-50 text-orange-700' }]
          .map(k => <div key={k.l} className={`card p-4 ${k.c}`}><p className="text-xs font-medium text-gray-500 uppercase">{k.l}</p><p className="text-2xl font-bold mt-1">{k.v}</p></div>)}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Nom, matricule…" className="flex-1 min-w-48" />
        <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1) }} className="input text-sm w-40">
          <option value="">Tous statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_deploiement} />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }} title={editing ? `Modifier APK — ${editing.tsp?.nom_prenoms}` : 'Nouveau déploiement APK'}
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="apk-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="apk-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editing && (
            <div>
              <label className="label label-required">TSP</label>
              <select className="input" value={addTspId} onChange={e => setAddTspId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {tspList.map(t => <option key={t.id_tsp} value={t.id_tsp}>{t.nom_prenoms} ({t.matricule ?? '—'}) — {t.societe_entite}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label label-required">Statut déploiement</label>
            <select className="input" {...register('statut_deploiement')}>
              {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Observation</label>
            <textarea rows={3} className="input resize-none" {...register('observation')} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
