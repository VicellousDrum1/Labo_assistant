import { useState, useEffect, useCallback } from 'react'
import { Smartphone, Plus, Pencil, PowerOff, RotateCcw, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useReferentiels } from '@/hooks/useReferentiels'
import type { TSP, Inventaire } from '@/types'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ImportExcel, type ImportColumn, type ImportResult } from '@/components/ui/ImportExcel'
import { exportToExcel } from '@/lib/utils'
import toast from 'react-hot-toast'

type TSPWithInv = TSP & { inventaire?: Inventaire }
type InvPick = Pick<Inventaire, 'id_materiel' | 'numero_inventaire' | 'numero_serie' | 'marque_modele'>

interface FormData {
  nom_prenoms: string; matricule: string; fonction: string; societe_entite: string
  exploitation: string; id_materiel: string; numero_puce: string; operateur: string; observations: string
}

const IMPORT_COLUMNS_TSP: ImportColumn[] = [
  { key: 'nom_prenoms',    header: 'Nom & Prénoms',   aliases: ['Nom prénom', 'Nom complet', 'Utilisateur'], required: true },
  { key: 'matricule',      header: 'Matricule',       aliases: ['Matricule agent'], required: false },
  { key: 'fonction',       header: 'Fonction',        aliases: ['Poste'], required: false },
  { key: 'societe_entite', header: 'Société / Entité', aliases: ['Société', 'Societe', 'Entité'], required: false },
  { key: 'exploitation',   header: 'Exploitation',     required: false },
  { key: 'numero_puce',    header: 'N° Puce',         aliases: ['Numéro puce', 'SIM', 'N° SIM'], required: false },
  { key: 'operateur',      header: 'Opérateur',       aliases: ['Operateur'], required: false },
  { key: 'observations',   header: 'Observations',    aliases: ['Observation', 'Commentaire'], required: false },
]

const IMPORT_EXAMPLE_TSP: Record<string, string> = {
  nom_prenoms:    'Jean Kouassi',
  matricule:      'M00123',
  fonction:       'Agent de terrain',
  societe_entite: 'Société A',
  exploitation:   'Exploitation Nord',
  numero_puce:    '0701234567',
  operateur:      'Orange',
  observations:   '',
}

interface FormData {
  nom_prenoms: string; matricule: string; fonction: string; societe_entite: string
  exploitation: string; id_materiel: string; numero_puce: string; operateur: string; observations: string
}

export function TSPPage() {
  const { isAssistant } = useAuth()
  const refs = useReferentiels()
  const [data, setData] = useState<TSPWithInv[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterSociete, setFilterSociete] = useState('')
  const [filterOp, setFilterOp] = useState('')
  const [showInactif, setShowInactif] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TSPWithInv | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<TSPWithInv | null>(null)
  const [tspMat, setTspMat] = useState<InvPick[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('tsp')
      .select(`*, inventaire:inventaire(id_materiel,numero_inventaire,numero_serie,marque_modele)`, { count: 'exact' })
      .eq('actif', !showInactif)
      .order('nom_prenoms').range(from, from + pageSize - 1)
    if (filterSociete) q = q.eq('societe_entite', filterSociete)
    if (filterOp) q = q.eq('operateur', filterOp)
    if (search.trim()) q = q.or(`nom_prenoms.ilike.%${search}%,matricule.ilike.%${search}%,numero_puce.ilike.%${search}%`)
    const { data, count } = await q
    setData((data as TSPWithInv[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, pageSize, search, filterSociete, filterOp, showInactif])

  useEffect(() => { load() }, [load])

  async function loadTSPMat() {
    const { data } = await supabase.from('inventaire').select('id_materiel,numero_inventaire,numero_serie,marque_modele')
      .eq('type_materiel', 'TSP').eq('actif', true).order('numero_inventaire')
    setTspMat(data ?? [])
  }

  function openCreate() {
    setEditing(null)
    reset({ nom_prenoms: '', matricule: '', fonction: '', societe_entite: '', exploitation: '', id_materiel: '', numero_puce: '', operateur: '', observations: '' })
    loadTSPMat(); setModalOpen(true)
  }

  function openEdit(row: TSPWithInv) {
    setEditing(row)
    reset({ nom_prenoms: row.nom_prenoms, matricule: row.matricule ?? '', fonction: row.fonction ?? '', societe_entite: row.societe_entite ?? '', exploitation: row.exploitation ?? '', id_materiel: row.id_materiel ?? '', numero_puce: row.numero_puce ?? '', operateur: row.operateur ?? '', observations: row.observations ?? '' })
    loadTSPMat(); setModalOpen(true)
  }

  async function onSubmit(form: FormData) {
    const payload = { ...form, id_materiel: form.id_materiel || null }
    try {
      if (editing) {
        await supabase.from('tsp').update(payload).eq('id_tsp', editing.id_tsp)
        await logAudit({ action: 'MODIFICATION', table_concernee: 'tsp', id_enregistrement: editing.id_tsp, nouvelles_valeurs: payload as unknown as Record<string, unknown> })
        toast.success('TSP mis à jour')
      } else {
        const { data: created } = await supabase.from('tsp').insert({ ...payload, actif: true }).select().single()
        if (created) await logAudit({ action: 'CREATION', table_concernee: 'tsp', id_enregistrement: created.id_tsp, nouvelles_valeurs: payload as unknown as Record<string, unknown> })
        toast.success('TSP créé')
      }
      setModalOpen(false); reset(); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  async function toggleActif(row: TSPWithInv, actif: boolean) {
    await supabase.from('tsp').update({ actif }).eq('id_tsp', row.id_tsp)
    await logAudit({ action: actif ? 'REACTIVATION' : 'DESACTIVATION', table_concernee: 'tsp', id_enregistrement: row.id_tsp, nouvelles_valeurs: { actif } })
    toast.success(actif ? 'TSP réactivé' : 'TSP désactivé')
    setDeactivateTarget(null); load()
  }

  const columns: Column<TSPWithInv>[] = [
    { key: 'nom_prenoms', header: 'Nom & Prénoms', sortable: true, render: r => <span className="font-medium">{r.nom_prenoms}</span> },
    { key: 'matricule', header: 'Matricule', render: r => <code className="text-xs text-gray-600">{r.matricule ?? '—'}</code> },
    { key: 'societe_entite', header: 'Société' },
    { key: 'exploitation', header: 'Exploitation' },
    { key: 'inventaire', header: 'N° Inv. TSP', render: r => <span className="font-mono text-xs text-primary-700">{r.inventaire?.numero_inventaire ?? '—'}</span> },
    { key: 'numero_puce', header: 'N° Puce', render: r => <code className="text-xs">{r.numero_puce ?? '—'}</code> },
    { key: 'operateur', header: 'Opérateur' },
    { key: 'actif', header: 'Statut', render: r => <span className={`badge ${r.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.actif ? 'Actif' : 'Inactif'}</span> },
    { key: 'actions', header: '', className: 'w-20 text-right',
      render: r => isAssistant ? (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(r)} className="btn-icon"><Pencil size={14} /></button>
          {r.actif
            ? <button onClick={() => setDeactivateTarget(r)} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"><PowerOff size={14} /></button>
            : <button onClick={() => toggleActif(r, true)} className="btn-icon text-green-500 hover:text-green-700 hover:bg-green-50"><RotateCcw size={14} /></button>
          }
        </div>
      ) : null
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Smartphone size={20} className="text-primary-700" />Suivi TSP</h1>
          <p className="page-subtitle">{total} TSP</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(data.map(r => ({ 'Nom & Prénoms': r.nom_prenoms, 'Matricule': r.matricule ?? '', 'Société': r.societe_entite ?? '', 'Exploitation': r.exploitation ?? '', 'N° Inventaire': r.inventaire?.numero_inventaire ?? '', 'N° Série': r.inventaire?.numero_serie ?? '', 'Modèle': r.inventaire?.marque_modele ?? '', 'N° Puce': r.numero_puce ?? '', 'Opérateur': r.operateur ?? '', 'Statut': r.actif ? 'Actif' : 'Inactif' })), 'tsp')} className="btn-secondary text-sm">Exporter</button>
          {isAssistant && (
            <>
              <button onClick={() => setImportOpen(true)} className="btn-secondary text-sm gap-1.5">
                <Upload size={14} /> Importer
              </button>
              <button onClick={openCreate} className="btn-primary text-sm gap-1.5"><Plus size={14} />Nouveau TSP</button>
            </>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Nom, matricule, numéro puce…" className="flex-1 min-w-48" />
        <select value={filterSociete} onChange={e => { setFilterSociete(e.target.value); setPage(1) }} className="input text-sm w-40">
          <option value="">Toutes sociétés</option>
          {refs.societes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterOp} onChange={e => { setFilterOp(e.target.value); setPage(1) }} className="input text-sm w-36">
          <option value="">Tous opérateurs</option>
          {refs.operateurs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showInactif} onChange={e => { setShowInactif(e.target.checked); setPage(1) }} className="rounded" />
          Inactifs
        </label>
      </div>

      <div className="card">
        <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_tsp} />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }} title={editing ? 'Modifier TSP' : 'Nouveau TSP'} size="xl"
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="tsp-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="tsp-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label label-required">Nom & Prénoms</label>
              <input className={`input ${errors.nom_prenoms ? 'input-error' : ''}`} {...register('nom_prenoms', { required: 'Le nom est requis' })} />
              {errors.nom_prenoms && <p className="mt-1 text-xs text-red-600">{errors.nom_prenoms.message}</p>}
            </div>
            <div>
              <label className="label">Matricule</label>
              <input className="input" {...register('matricule')} />
            </div>
            <div>
              <label className="label">Fonction</label>
              <input className="input" {...register('fonction')} />
            </div>
            <div>
              <label className="label">Société / Entité</label>
              <select className="input" {...register('societe_entite')}>
                <option value="">—</option>
                {refs.societes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Exploitation</label>
              <select className="input" {...register('exploitation')}>
                <option value="">—</option>
                {refs.exploitations.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Appareil TSP (depuis l'inventaire)</label>
            <select className="input" {...register('id_materiel')}>
              <option value="">— Aucun —</option>
              {tspMat.map(m => <option key={m.id_materiel} value={m.id_materiel}>{m.numero_inventaire} — {m.marque_modele} (S/N: {m.numero_serie ?? '—'})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">N° Puce</label>
              <input className="input" {...register('numero_puce')} />
            </div>
            <div>
              <label className="label">Opérateur</label>
              <select className="input" {...register('operateur')}>
                <option value="">—</option>
                {refs.operateurs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea rows={2} className="input resize-none" {...register('observations')} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && toggleActif(deactivateTarget, false)}
        title="Désactiver le TSP" message={`Désactiver "${deactivateTarget?.nom_prenoms}" ?`}
        confirmLabel="Désactiver" danger />

      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer les TSP depuis Excel"
        columns={IMPORT_COLUMNS_TSP}
        templateName="tsp"
        templateExample={IMPORT_EXAMPLE_TSP}
        onImport={async (rows) => {
          let inserted = 0
          const errors: { row: number; message: string }[] = []
          for (let i = 0; i < rows.length; i++) {
            try {
              const { data: created, error } = await supabase
                .from('tsp').insert({ ...rows[i], actif: true }).select('id_tsp').single()
              if (error) throw error
              await logAudit({ action: 'IMPORT', table_concernee: 'tsp', id_enregistrement: created.id_tsp, nouvelles_valeurs: rows[i] })
              inserted++
            } catch (e: unknown) {
              errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Erreur' })
            }
          }
          if (inserted > 0) { toast.success(`${inserted} TSP importé${inserted > 1 ? 's' : ''}`); load() }
          return { total: rows.length, inserted, errors } as ImportResult
        }}
      />
    </div>
  )
}
