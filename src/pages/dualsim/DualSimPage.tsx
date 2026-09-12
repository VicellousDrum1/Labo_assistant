import { useState, useEffect, useCallback } from 'react'
import { Wifi, Plus, Pencil, PowerOff, RotateCcw, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { batchInsert, batchLogAudit } from '@/lib/importHelpers'
import { useAuth } from '@/context/AuthContext'
import { useReferentiels } from '@/hooks/useReferentiels'
import type { SiteDualsim, Inventaire } from '@/types'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ImportExcel, type ImportColumn, type ImportResult } from '@/components/ui/ImportExcel'
import { exportToExcel } from '@/lib/utils'
import toast from 'react-hot-toast'

type DsimWithInv = SiteDualsim & { inventaire?: Inventaire }
type InvPick = Pick<Inventaire, 'id_materiel' | 'numero_inventaire' | 'marque_modele'>

interface FormData {
  utilisateur: string; site: string; societe: string; adresse_routeur: string
  id_materiel: string; numero_sim1: string; operateur_sim1: string
  numero_sim2: string; operateur_sim2: string; observation: string
}

const IMPORT_COLUMNS_DSIM: ImportColumn[] = [
  { key: 'site',           header: 'Site',             required: false },
  { key: 'utilisateur',    header: 'Utilisateur',      required: false },
  { key: 'societe',        header: 'Société',          required: false },
  { key: 'adresse_routeur',header: 'Adresse routeur',  required: false },
  { key: 'numero_sim1',    header: 'N° SIM 1',         required: false },
  { key: 'operateur_sim1', header: 'Opérateur SIM 1',  required: false },
  { key: 'numero_sim2',    header: 'N° SIM 2',         required: false },
  { key: 'operateur_sim2', header: 'Opérateur SIM 2',  required: false },
  { key: 'observation',    header: 'Observation',      required: false },
]

const IMPORT_EXAMPLE_DSIM: Record<string, string> = {
  site:            'Site Abidjan Nord',
  utilisateur:     'Konan Yao',
  societe:         'Société A',
  adresse_routeur: '192.168.10.1',
  numero_sim1:     '0701234567',
  operateur_sim1:  'Orange',
  numero_sim2:     '0501234567',
  operateur_sim2:  'MTN',
  observation:     '',
}

interface FormData {
  utilisateur: string; site: string; societe: string; adresse_routeur: string
  id_materiel: string; numero_sim1: string; operateur_sim1: string
  numero_sim2: string; operateur_sim2: string; observation: string
}

export function DualSimPage() {
  const { isAssistant, user } = useAuth()
  const refs = useReferentiels()
  const [data, setData] = useState<DsimWithInv[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [showInactif, setShowInactif] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DsimWithInv | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<DsimWithInv | null>(null)
  const [routeurs, setRouteurs] = useState<InvPick[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('site_dualsim')
      .select(`*, inventaire:inventaire(id_materiel,numero_inventaire,marque_modele)`, { count: 'exact' })
      .eq('actif', !showInactif)
      .order('created_at', { ascending: false }).range(from, from + pageSize - 1)
    if (search.trim()) q = q.or(`site.ilike.%${search}%,utilisateur.ilike.%${search}%,numero_sim1.ilike.%${search}%,numero_sim2.ilike.%${search}%`)
    const { data, count } = await q
    setData((data as DsimWithInv[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, pageSize, search, showInactif])

  useEffect(() => { load() }, [load])

  async function loadRouteurs() {
    const { data } = await supabase.from('inventaire').select('id_materiel,numero_inventaire,marque_modele')
      .eq('type_materiel', 'Routeur').eq('actif', true).order('numero_inventaire')
    setRouteurs(data ?? [])
  }

  function openCreate() {
    setEditing(null)
    reset({ utilisateur: '', site: '', societe: '', adresse_routeur: '', id_materiel: '', numero_sim1: '', operateur_sim1: '', numero_sim2: '', operateur_sim2: '', observation: '' })
    loadRouteurs(); setModalOpen(true)
  }

  function openEdit(row: DsimWithInv) {
    setEditing(row)
    reset({ utilisateur: row.utilisateur ?? '', site: row.site ?? '', societe: row.societe ?? '', adresse_routeur: row.adresse_routeur ?? '', id_materiel: row.id_materiel ?? '', numero_sim1: row.numero_sim1 ?? '', operateur_sim1: row.operateur_sim1 ?? '', numero_sim2: row.numero_sim2 ?? '', operateur_sim2: row.operateur_sim2 ?? '', observation: row.observation ?? '' })
    loadRouteurs(); setModalOpen(true)
  }

  async function onSubmit(form: FormData) {
    const payload = { ...form, id_materiel: form.id_materiel || null }
    try {
      if (editing) {
        await supabase.from('site_dualsim').update(payload).eq('id_dualsim', editing.id_dualsim)
        await logAudit({ action: 'MODIFICATION', table_concernee: 'site_dualsim', id_enregistrement: editing.id_dualsim, nouvelles_valeurs: payload as unknown as Record<string, unknown> })
        toast.success('Site mis à jour')
      } else {
        const { data: created } = await supabase.from('site_dualsim').insert({ ...payload, actif: true }).select().single()
        if (created) await logAudit({ action: 'CREATION', table_concernee: 'site_dualsim', id_enregistrement: created.id_dualsim, nouvelles_valeurs: payload as unknown as Record<string, unknown> })
        toast.success('Site créé')
      }
      setModalOpen(false); reset(); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  async function toggleActif(row: DsimWithInv, actif: boolean) {
    await supabase.from('site_dualsim').update({ actif }).eq('id_dualsim', row.id_dualsim)
    await logAudit({ action: actif ? 'REACTIVATION' : 'DESACTIVATION', table_concernee: 'site_dualsim', id_enregistrement: row.id_dualsim, nouvelles_valeurs: { actif } })
    toast.success(actif ? 'Site réactivé' : 'Site désactivé')
    setDeactivateTarget(null); load()
  }

  const columns: Column<DsimWithInv>[] = [
    { key: 'site', header: 'Site', render: r => <span className="font-medium">{r.site ?? '—'}</span> },
    { key: 'utilisateur', header: 'Utilisateur' },
    { key: 'societe', header: 'Société' },
    { key: 'adresse_routeur', header: 'Adresse routeur', render: r => <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.adresse_routeur ?? '—'}</code> },
    { key: 'inventaire', header: 'N° Inventaire routeur', render: r => <span className="font-mono text-xs text-primary-700">{r.inventaire?.numero_inventaire ?? '—'}</span> },
    { key: 'sim1', header: 'SIM 1', render: r => r.numero_sim1 ? <span className="text-xs">{r.operateur_sim1} — {r.numero_sim1}</span> : <span className="text-gray-300">—</span> },
    { key: 'sim2', header: 'SIM 2', render: r => r.numero_sim2 ? <span className="text-xs">{r.operateur_sim2} — {r.numero_sim2}</span> : <span className="text-gray-300">—</span> },
    { key: 'actif', header: 'Statut', render: r => <span className={`badge ${r.actif ? 'bg-ok-100 text-ok-700' : 'bg-danger-100 text-danger-700'}`}>{r.actif ? 'Actif' : 'Inactif'}</span> },
    { key: 'actions', header: '', className: 'w-20 text-right',
      render: r => isAssistant ? (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(r)} className="btn-icon"><Pencil size={14} /></button>
          {r.actif
            ? <button onClick={() => setDeactivateTarget(r)} className="btn-icon text-danger-500 hover:text-danger-700 hover:bg-danger-50" title="Désactiver"><PowerOff size={14} /></button>
            : <button onClick={() => toggleActif(r, true)} className="btn-icon text-ok-500 hover:text-ok-700 hover:bg-ok-50" title="Réactiver"><RotateCcw size={14} /></button>
          }
        </div>
      ) : null
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Wifi size={20} className="text-primary-700" />Sites Dual-SIM</h1>
          <p className="page-subtitle">{total} site{total > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(data.map(r => ({ 'Site': r.site ?? '', 'Utilisateur': r.utilisateur ?? '', 'Société': r.societe ?? '', 'Adresse routeur': r.adresse_routeur ?? '', 'N° Inv routeur': r.inventaire?.numero_inventaire ?? '', 'SIM 1': r.numero_sim1 ?? '', 'Opérateur 1': r.operateur_sim1 ?? '', 'SIM 2': r.numero_sim2 ?? '', 'Opérateur 2': r.operateur_sim2 ?? '' })), 'dual_sim')} className="btn-secondary text-sm">Exporter</button>
          {isAssistant && (
            <>
              <button onClick={() => setImportOpen(true)} className="btn-secondary text-sm gap-1.5">
                <Upload size={14} /> Importer
              </button>
              <button onClick={openCreate} className="btn-primary text-sm gap-1.5"><Plus size={14} />Nouveau site</button>
            </>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Site, utilisateur, numéro SIM…" className="flex-1 min-w-48" />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showInactif} onChange={e => { setShowInactif(e.target.checked); setPage(1) }} className="rounded" />
          Afficher inactifs
        </label>
      </div>

      <div className="card">
        <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_dualsim} />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }} title={editing ? 'Modifier le site' : 'Nouveau site Dual-SIM'} size="xl"
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="dsim-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="dsim-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Site</label>
              <input className="input" {...register('site')} />
            </div>
            <div>
              <label className="label">Utilisateur</label>
              <input className="input" {...register('utilisateur')} />
            </div>
            <div>
              <label className="label">Société</label>
              <select className="input" {...register('societe')}>
                <option value="">—</option>
                {refs.societes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Adresse routeur</label>
              <input className="input" placeholder="192.168.1.1" {...register('adresse_routeur')} />
            </div>
          </div>
          <div>
            <label className="label">Routeur (depuis l'inventaire)</label>
            <select className="input" {...register('id_materiel')}>
              <option value="">— Aucun —</option>
              {routeurs.map(r => <option key={r.id_materiel} value={r.id_materiel}>{r.numero_inventaire} — {r.marque_modele}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">N° SIM 1</label>
              <input className="input" {...register('numero_sim1')} />
            </div>
            <div>
              <label className="label">Opérateur SIM 1</label>
              <select className="input" {...register('operateur_sim1')}>
                <option value="">—</option>
                {refs.operateurs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">N° SIM 2</label>
              <input className="input" {...register('numero_sim2')} />
            </div>
            <div>
              <label className="label">Opérateur SIM 2</label>
              <select className="input" {...register('operateur_sim2')}>
                <option value="">—</option>
                {refs.operateurs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Observation</label>
            <textarea rows={2} className="input resize-none" {...register('observation')} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && toggleActif(deactivateTarget, false)}
        title="Désactiver le site" message={`Désactiver le site "${deactivateTarget?.site}" ?`}
        confirmLabel="Désactiver" danger />

      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer les sites Dual-SIM depuis Excel"
        columns={IMPORT_COLUMNS_DSIM}
        templateName="dual_sim"
        templateExample={IMPORT_EXAMPLE_DSIM}
        onImport={async (rows) => {
          const payloads = rows.map(r => ({ ...r, actif: true }))
          const { created, errorsByIndex } = await batchInsert<{ id_dualsim: string }>('site_dualsim', payloads, 'id_dualsim')
          const errors: { row: number; message: string }[] = []
          errorsByIndex.forEach((message, i) => errors.push({ row: i + 2, message }))

          const auditEntries = created
            .map((c, i) => ({ c, row: rows[i] }))
            .filter(({ c }) => c)
            .map(({ c, row }) => ({
              utilisateur: user?.id ?? null, action: 'IMPORT', table_concernee: 'site_dualsim',
              id_enregistrement: c!.id_dualsim, nouvelles_valeurs: row,
            }))
          await batchLogAudit(auditEntries)

          const inserted = created.filter(Boolean).length
          if (inserted > 0) { toast.success(`${inserted} site${inserted > 1 ? 's' : ''} importé${inserted > 1 ? 's' : ''}`); load() }
          return { total: rows.length, inserted, errors } as ImportResult
        }}
      />
    </div>
  )
}
