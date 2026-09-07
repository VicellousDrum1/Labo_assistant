import { useState, useEffect, useCallback } from 'react'
import { Ticket, Plus, Pencil, Eye, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useReferentiels } from '@/hooks/useReferentiels'
import type { SuiviDiDs } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { ImportExcel, type ImportColumn, type ImportResult } from '@/components/ui/ImportExcel'
import { exportToExcel, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUTS = ['Nouveau', 'Affecté', 'En cours', 'En attente', 'Résolu', 'Clôturé', 'Annulé']
const PRIORITES = ['Faible', 'Normale', 'Haute', 'Critique']
const TYPES = ['DI', 'DS']

const IMPORT_COLUMNS_DIDS: ImportColumn[] = [
  { key: 'type_demande',   header: 'Type (DI/DS)',     aliases: ['Type', 'DI/DS'], required: true,
    validate: v => ['DI','DS'].includes(v) ? null : 'Type invalide, valeurs acceptées : DI ou DS' },
  { key: 'numero_demande', header: 'N° Demande',       aliases: ['Numéro demande', 'N° DI/DS'], required: false },
  { key: 'date_demande',   header: 'Date demande',     aliases: ['Date', 'Date DI/DS'], required: false,
    transform: v => v || null },
  { key: 'demandeur',      header: 'Demandeur',        required: false },
  { key: 'societe',        header: 'Société',          required: false },
  { key: 'exploitation',   header: 'Exploitation',     required: false },
  { key: 'site',           header: 'Site',             required: false },
  { key: 'objet',          header: 'Objet',            aliases: ['Demande', 'Description'], required: true },
  { key: 'priorite',       header: 'Priorité',         required: false,
    validate: v => !v || PRIORITES.includes(v) ? null : `Priorité invalide : "${v}"`,
    transform: v => v || 'Normale' },
  { key: 'statut',         header: 'Statut',           required: false,
    validate: v => !v || STATUTS.includes(v) ? null : `Statut invalide : "${v}"`,
    transform: v => v || 'Nouveau' },
  { key: 'technicien',     header: 'Technicien',       required: false },
  { key: 'observation',    header: 'Observation',      required: false },
]

const IMPORT_EXAMPLE_DIDS: Record<string, string> = {
  type_demande:   'DI',
  numero_demande: 'DI-2024-001',
  date_demande:   '2024-01-15',
  demandeur:      'Koné Mamadou',
  societe:        'Société A',
  exploitation:   'Exploitation Nord',
  site:           'Site Bouaké',
  objet:          'Panne PC bureau 12',
  priorite:       'Haute',
  statut:         'Nouveau',
  technicien:     '',
  observation:    '',
}

interface FormData {
  type_demande: string; numero_demande: string; date_demande: string; demandeur: string
  societe: string; exploitation: string; site: string; objet: string; priorite: string
  statut: string; technicien: string; date_cloture: string; observation: string
}

export function DiDsPage() {
  const { isAssistant } = useAuth()
  const refs = useReferentiels()
  const [data, setData] = useState<SuiviDiDs[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPriorite, setFilterPriorite] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewItem, setViewItem] = useState<SuiviDiDs | null>(null)
  const [editing, setEditing] = useState<SuiviDiDs | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('suivi_di_ds').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, from + pageSize - 1)
    if (filterStatut) q = q.eq('statut', filterStatut)
    if (filterType) q = q.eq('type_demande', filterType)
    if (filterPriorite) q = q.eq('priorite', filterPriorite)
    if (search.trim()) q = q.or(`numero_demande.ilike.%${search}%,demandeur.ilike.%${search}%,objet.ilike.%${search}%,technicien.ilike.%${search}%`)
    const { data, count } = await q
    setData(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, pageSize, search, filterStatut, filterType, filterPriorite])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    reset({ type_demande: 'DI', numero_demande: '', date_demande: new Date().toISOString().slice(0, 10), demandeur: '', societe: '', exploitation: '', site: '', objet: '', priorite: 'Normale', statut: 'Nouveau', technicien: '', date_cloture: '', observation: '' })
    setModalOpen(true)
  }

  function openEdit(row: SuiviDiDs) {
    setEditing(row)
    reset({
      type_demande: row.type_demande, numero_demande: row.numero_demande ?? '', date_demande: row.date_demande ?? '',
      demandeur: row.demandeur ?? '', societe: row.societe ?? '', exploitation: row.exploitation ?? '',
      site: row.site ?? '', objet: row.objet, priorite: row.priorite, statut: row.statut,
      technicien: row.technicien ?? '', date_cloture: row.date_cloture ?? '', observation: row.observation ?? '',
    })
    setModalOpen(true)
  }

  async function onSubmit(form: FormData) {
    const payload = { ...form, date_demande: form.date_demande || null, date_cloture: form.date_cloture || null }
    try {
      if (editing) {
        await supabase.from('suivi_di_ds').update(payload).eq('id_di_ds', editing.id_di_ds)
        await logAudit({ action: 'MODIFICATION', table_concernee: 'suivi_di_ds', id_enregistrement: editing.id_di_ds, nouvelles_valeurs: payload as unknown as Record<string, unknown> })
        toast.success('Demande mise à jour')
      } else {
        const { data: created } = await supabase.from('suivi_di_ds').insert(payload).select().single()
        if (created) await logAudit({ action: 'CREATION', table_concernee: 'suivi_di_ds', id_enregistrement: created.id_di_ds, nouvelles_valeurs: payload as unknown as Record<string, unknown> })
        toast.success('Demande créée')
      }
      setModalOpen(false); reset(); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  const prioriteColor: Record<string, string> = {
    Faible: '🔵', Normale: '⚪', Haute: '🟠', Critique: '🔴'
  }

  const columns: Column<SuiviDiDs>[] = [
    { key: 'type_demande', header: 'Type', render: r => <span className={`badge text-xs ${r.type_demande === 'DI' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{r.type_demande}</span> },
    { key: 'numero_demande', header: 'N° Demande', render: r => <code className="text-xs font-semibold">{r.numero_demande ?? '—'}</code> },
    { key: 'date_demande', header: 'Date', render: r => <span className="text-xs text-gray-500">{formatDate(r.date_demande)}</span> },
    { key: 'demandeur', header: 'Demandeur' },
    { key: 'objet', header: 'Objet', render: r => (
      <button onClick={() => setViewItem(r)} className="text-left text-sm hover:text-primary-700 transition-colors max-w-xs truncate block">
        {r.objet}
      </button>
    )},
    { key: 'priorite', header: 'Priorité', render: r => <span className="text-sm">{prioriteColor[r.priorite]} <Badge value={r.priorite} /></span> },
    { key: 'statut', header: 'Statut', render: r => <Badge value={r.statut} /> },
    { key: 'technicien', header: 'Technicien' },
    { key: 'actions', header: '', className: 'w-20 text-right',
      render: r => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setViewItem(r)} className="btn-icon" title="Voir"><Eye size={14} /></button>
          {isAssistant && <button onClick={() => openEdit(r)} className="btn-icon" title="Modifier"><Pencil size={14} /></button>}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Ticket size={20} className="text-primary-700" />Suivi DI / DS</h1>
          <p className="page-subtitle">{total} demande{total > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(data.map(r => ({ 'Type': r.type_demande, 'N°': r.numero_demande ?? '', 'Date': formatDate(r.date_demande), 'Demandeur': r.demandeur ?? '', 'Objet': r.objet, 'Priorité': r.priorite, 'Statut': r.statut, 'Technicien': r.technicien ?? '' })), 'di_ds')} className="btn-secondary text-sm">Exporter</button>
          {isAssistant && <>
            <button onClick={() => setImportOpen(true)} className="btn-secondary text-sm gap-1.5"><Upload size={14} />Importer</button>
            <button onClick={openCreate} className="btn-primary text-sm gap-1.5"><Plus size={14} />Nouvelle demande</button>
          </>}
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="N°, demandeur, objet, technicien…" className="flex-1 min-w-56" />
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }} className="input text-sm w-24">
          <option value="">Tous</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1) }} className="input text-sm w-36">
          <option value="">Tous statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPriorite} onChange={e => { setFilterPriorite(e.target.value); setPage(1) }} className="input text-sm w-36">
          <option value="">Toutes priorités</option>
          {PRIORITES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_di_ds} />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      {/* Modal détail */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={`Détail demande ${viewItem?.numero_demande ?? ''}`} size="lg">
        {viewItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {([['Type', viewItem.type_demande], ['N° Demande', viewItem.numero_demande], ['Date', formatDate(viewItem.date_demande)], ['Demandeur', viewItem.demandeur], ['Société', viewItem.societe], ['Exploitation', viewItem.exploitation], ['Site', viewItem.site], ['Technicien', viewItem.technicien], ['Date clôture', formatDate(viewItem.date_cloture)]] as [string, string | null][]).map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-gray-400 font-medium">{l}</p>
                  <p className="text-gray-700">{v || '—'}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-gray-400 font-medium">Priorité</p>
                <Badge value={viewItem.priorite} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Statut</p>
                <Badge value={viewItem.statut} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">Objet</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{viewItem.objet}</p>
            </div>
            {viewItem.observation && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">Observation</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewItem.observation}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal create/edit */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }}
        title={editing ? 'Modifier la demande' : 'Nouvelle demande DI/DS'} size="xl"
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="dids-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="dids-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label label-required">Type</label>
              <select className="input" {...register('type_demande', { required: true })}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">N° Demande</label>
              <input className="input" placeholder="DI-2024-001" {...register('numero_demande')} />
            </div>
            <div>
              <label className="label">Date demande</label>
              <input type="date" className="input" {...register('date_demande')} />
            </div>
            <div>
              <label className="label">Demandeur</label>
              <input className="input" {...register('demandeur')} />
            </div>
            <div>
              <label className="label">Société</label>
              <select className="input" {...register('societe')}>
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
            <div>
              <label className="label">Site</label>
              <input className="input" {...register('site')} />
            </div>
            <div>
              <label className="label">Technicien</label>
              <input className="input" {...register('technicien')} />
            </div>
            <div>
              <label className="label label-required">Priorité</label>
              <select className="input" {...register('priorite', { required: true })}>
                {PRIORITES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label label-required">Statut</label>
              <select className="input" {...register('statut', { required: true })}>
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date clôture</label>
              <input type="date" className="input" {...register('date_cloture')} />
            </div>
          </div>
          <div>
            <label className="label label-required">Objet de la demande</label>
            <textarea rows={3} className={`input resize-none ${errors.objet ? 'input-error' : ''}`}
              placeholder="Décrivez la demande…"
              {...register('objet', { required: "L'objet est requis" })} />
            {errors.objet && <p className="mt-1 text-xs text-red-600">{errors.objet.message}</p>}
          </div>
          <div>
            <label className="label">Observation</label>
            <textarea rows={2} className="input resize-none" {...register('observation')} />
          </div>
        </form>
      </Modal>

      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer les demandes DI / DS depuis Excel"
        columns={IMPORT_COLUMNS_DIDS}
        templateName="suivi_di_ds"
        templateExample={IMPORT_EXAMPLE_DIDS}
        onImport={async (rows) => {
          let inserted = 0
          const importErrors: { row: number; message: string }[] = []
          for (let i = 0; i < rows.length; i++) {
            try {
              const { data: created, error } = await supabase.from('suivi_di_ds').insert(rows[i]).select('id_di_ds').single()
              if (error) throw error
              await logAudit({ action: 'IMPORT', table_concernee: 'suivi_di_ds', id_enregistrement: created.id_di_ds, nouvelles_valeurs: rows[i] })
              inserted++
            } catch (e: unknown) {
              importErrors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Erreur inconnue' })
            }
          }
          if (inserted) { toast.success(`${inserted} demande${inserted > 1 ? 's' : ''} importée${inserted > 1 ? 's' : ''}`); load() }
          return { total: rows.length, inserted, errors: importErrors } as ImportResult
        }}
      />
    </div>
  )
}
