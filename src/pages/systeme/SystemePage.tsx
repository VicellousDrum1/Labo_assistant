import { useState, useEffect, useCallback } from 'react'
import { Monitor, Pencil, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { SystemeExploitation, Inventaire } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { exportToExcel, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type SysWithInv = SystemeExploitation & { inventaire: Inventaire }
type InvPick = Pick<Inventaire, 'id_materiel' | 'numero_inventaire' | 'marque_modele' | 'utilisateur'>
const STATUTS: string[] = ['Non migré', 'En cours de migration', 'Migré']

interface FormData { statut_systeme: string; observation: string }

export function SystemePage() {
  const { isAssistant } = useAuth()
  const [data, setData] = useState<SysWithInv[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SysWithInv | null>(null)
  const [addMaterielId, setAddMaterielId] = useState('')
  const [pcs, setPcs] = useState<InvPick[]>([])
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase
      .from('systeme_exploitation')
      .select(`*, inventaire:inventaire(id_materiel,numero_inventaire,marque_modele,utilisateur,societe,exploitation)`, { count: 'exact' })
      .order('date_modification', { ascending: false })
      .range(from, from + pageSize - 1)
    if (filterStatut) q = q.eq('statut_systeme', filterStatut)
    const { data, count } = await q
    let rows = (data as SysWithInv[]) ?? []
    if (search.trim()) {
      const s = search.toLowerCase()
      rows = rows.filter(r =>
        r.inventaire?.numero_inventaire?.toLowerCase().includes(s) ||
        r.inventaire?.utilisateur?.toLowerCase().includes(s) ||
        r.inventaire?.marque_modele?.toLowerCase().includes(s)
      )
    }
    setData(rows)
    setTotal(search.trim() ? rows.length : (count ?? 0))
    setLoading(false)
  }, [page, pageSize, search, filterStatut])

  useEffect(() => { load() }, [load])

  async function loadPCs() {
    // Charger les PCs qui n'ont pas encore de suivi OS
    const { data: existing } = await supabase.from('systeme_exploitation').select('id_materiel')
    const existingIds = existing?.map(r => r.id_materiel) ?? []
    let q = supabase.from('inventaire')
      .select('id_materiel,numero_inventaire,marque_modele,utilisateur')
      .in('type_materiel', ['Ordinateur de bureau', 'Ordinateur portable'])
      .eq('actif', true)
      .order('numero_inventaire')
    if (existingIds.length) q = q.not('id_materiel', 'in', `(${existingIds.map(id => `"${id}"`).join(',')})`)
    const { data } = await q
    setPcs(data ?? [])
  }

  function openEdit(row: SysWithInv) {
    setEditing(row)
    reset({ statut_systeme: row.statut_systeme, observation: row.observation ?? '' })
    setModalOpen(true)
  }

  function openCreate() {
    setEditing(null)
    reset({ statut_systeme: 'Non migré', observation: '' })
    loadPCs()
    setModalOpen(true)
  }

  async function onSubmit(form: FormData) {
    try {
      if (editing) {
        const { error } = await supabase.from('systeme_exploitation')
          .update({ statut_systeme: form.statut_systeme, observation: form.observation, date_modification: new Date().toISOString() })
          .eq('id_systeme', editing.id_systeme)
        if (error) throw error
        await logAudit({ action: 'MODIFICATION', table_concernee: 'systeme_exploitation', id_enregistrement: editing.id_systeme, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Statut OS mis à jour')
      } else {
        if (!addMaterielId) { toast.error('Sélectionner un matériel'); return }
        const { data: created, error } = await supabase.from('systeme_exploitation')
          .insert({ id_materiel: addMaterielId, statut_systeme: form.statut_systeme, observation: form.observation })
          .select().single()
        if (error) throw error
        await logAudit({ action: 'CREATION', table_concernee: 'systeme_exploitation', id_enregistrement: created.id_systeme, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Suivi OS créé')
      }
      setModalOpen(false)
      reset()
      setAddMaterielId('')
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  // KPIs inline
  const kpi = {
    total: total,
    migres: data.filter(r => r.statut_systeme === 'Migré').length,
    enCours: data.filter(r => r.statut_systeme === 'En cours de migration').length,
    nonMigres: data.filter(r => r.statut_systeme === 'Non migré').length,
  }

  const columns: Column<SysWithInv>[] = [
    { key: 'numero_inventaire', header: 'N° Inventaire',
      render: r => <span className="font-mono text-xs text-primary-700 font-semibold">{r.inventaire?.numero_inventaire ?? '—'}</span> },
    { key: 'marque_modele', header: 'Modèle', render: r => r.inventaire?.marque_modele ?? '—' },
    { key: 'utilisateur', header: 'Utilisateur', render: r => r.inventaire?.utilisateur ?? '—' },
    { key: 'societe', header: 'Société', render: r => r.inventaire?.societe ?? '—' },
    { key: 'exploitation', header: 'Exploitation', render: r => r.inventaire?.exploitation ?? '—' },
    { key: 'statut_systeme', header: 'Statut OS', render: r => <Badge value={r.statut_systeme} /> },
    { key: 'date_modification', header: 'Mis à jour', render: r => <span className="text-xs text-gray-500">{formatDate(r.date_modification)}</span> },
    { key: 'actions', header: '', className: 'w-16 text-right',
      render: r => isAssistant ? (
        <button onClick={() => openEdit(r)} className="btn-icon" title="Modifier"><Pencil size={14} /></button>
      ) : null
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Monitor size={20} className="text-primary-700" />Systèmes d'exploitation</h1>
          <p className="page-subtitle">Suivi des migrations OS</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(data.map(r => ({
            'N° Inv': r.inventaire?.numero_inventaire ?? '',
            'Modèle': r.inventaire?.marque_modele ?? '',
            'Utilisateur': r.inventaire?.utilisateur ?? '',
            'Statut': r.statut_systeme,
            'Mis à jour': formatDate(r.date_modification),
          })), 'systeme_exploitation')} className="btn-secondary text-sm">Exporter</button>
          {isAssistant && <button onClick={openCreate} className="btn-primary text-sm gap-1.5"><Plus size={14} />Ajouter</button>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: kpi.total, color: 'bg-blue-50 text-blue-700' },
          { label: 'Migrés', value: kpi.migres, color: 'bg-green-50 text-green-700' },
          { label: 'En cours', value: kpi.enCours, color: 'bg-orange-50 text-orange-700' },
          { label: 'Non migrés', value: kpi.nonMigres, color: 'bg-red-50 text-red-700' },
        ].map(k => (
          <div key={k.label} className={`card p-4 ${k.color}`}>
            <p className="text-xs font-medium text-gray-500 uppercase">{k.label}</p>
            <p className="text-2xl font-bold mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="N° inventaire, utilisateur…" className="flex-1 min-w-48" />
        <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1) }} className="input text-sm w-52">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_systeme} />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); setAddMaterielId('') }}
        title={editing ? `Modifier OS — ${editing.inventaire?.numero_inventaire}` : 'Nouveau suivi OS'}
        footer={<>
          <button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button>
          <button form="os-form" type="submit" className="btn-primary">Enregistrer</button>
        </>}>
        <form id="os-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editing && (
            <div>
              <label className="label label-required">Matériel (PC)</label>
              <select className="input" value={addMaterielId} onChange={e => setAddMaterielId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {pcs.map(pc => <option key={pc.id_materiel} value={pc.id_materiel}>{pc.numero_inventaire} — {pc.marque_modele} ({pc.utilisateur ?? '—'})</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label label-required">Statut OS</label>
            <select className={`input ${errors.statut_systeme ? 'input-error' : ''}`}
              {...register('statut_systeme', { required: 'Le statut est requis' })}>
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
