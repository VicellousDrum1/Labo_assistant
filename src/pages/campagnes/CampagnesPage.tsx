import { useState, useEffect, useCallback } from 'react'
import { Settings2, Plus, Eye, Pencil, BarChart3, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { fetchExistingSet, batchInsert, batchLogAudit } from '@/lib/importHelpers'
import { useAuth } from '@/context/AuthContext'
import type { Campagne } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { ImportExcel, type ImportColumn, type ImportResult } from '@/components/ui/ImportExcel'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUTS = ['Planifiée', 'En cours', 'Terminée', 'Suspendue', 'Annulée']
const TYPES = ['OS', 'Bureautique', 'Sécurité', 'Réseau', 'Logiciel métier', 'Autre']

interface FormData {
  nom: string; description: string; type_campagne: string
  date_debut: string; date_fin_prevue: string; statut: string
}

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'nom',             header: 'Nom de la campagne', required: true },
  { key: 'type_campagne',   header: 'Type',      required: false,
    validate: v => !v || TYPES.includes(v) ? null : `Type invalide : "${v}"` },
  { key: 'date_debut',      header: 'Date début',      required: false,
    validate: v => !v || !isNaN(Date.parse(v)) ? null : `Date invalide : "${v}" (format AAAA-MM-JJ)` },
  { key: 'date_fin_prevue', header: 'Date fin prévue', required: false,
    validate: v => !v || !isNaN(Date.parse(v)) ? null : `Date invalide : "${v}" (format AAAA-MM-JJ)` },
  { key: 'statut',          header: 'Statut',    required: true,
    validate: v => STATUTS.includes(v) ? null : `Statut invalide : "${v}"` },
  { key: 'description',     header: 'Description', required: false },
]
const IMPORT_EXAMPLE: Record<string, string> = {
  nom: 'Migration Windows 11',
  type_campagne: 'OS',
  date_debut: '2025-01-15',
  date_fin_prevue: '2025-06-30',
  statut: 'Planifiée',
  description: '',
}

export function CampagnesPage() {
  const navigate = useNavigate()
  const { isAssistant, user } = useAuth()
  const [data, setData] = useState<Campagne[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Campagne | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('campagnes').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, from + pageSize - 1)
    if (filterStatut) q = q.eq('statut', filterStatut)
    if (search.trim()) q = q.ilike('nom', `%${search}%`)
    const { data, count } = await q
    setData(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, pageSize, search, filterStatut])

  useEffect(() => { load() }, [load])

  async function onSubmit(form: FormData) {
    try {
      if (editing) {
        await supabase.from('campagnes').update(form).eq('id_campagne', editing.id_campagne)
        await logAudit({ action: 'MODIFICATION', table_concernee: 'campagnes', id_enregistrement: editing.id_campagne, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Campagne mise à jour')
      } else {
        const { data: created } = await supabase.from('campagnes')
          .insert({ ...form, actif: true, created_by: user?.id }).select().single()
        if (created) await logAudit({ action: 'CREATION', table_concernee: 'campagnes', id_enregistrement: created.id_campagne, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Campagne créée')
      }
      setModalOpen(false); reset(); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportResult> {
    const noms = rows.map(r => String(r.nom ?? '').trim())
    const existingNoms = await fetchExistingSet('campagnes', 'nom', noms)

    const errors: { row: number; message: string }[] = []
    const seenNoms = new Set<string>()
    const validRows: { origIndex: number; payload: Record<string, unknown> }[] = []

    rows.forEach((row, i) => {
      const nom = String(row.nom ?? '').trim()
      if (existingNoms.has(nom)) {
        errors.push({ row: i + 2, message: `Une campagne nommée "${nom}" existe déjà` }); return
      }
      if (seenNoms.has(nom)) {
        errors.push({ row: i + 2, message: `"${nom}" en double dans le fichier` }); return
      }
      seenNoms.add(nom)
      validRows.push({
        origIndex: i,
        payload: {
          nom,
          type_campagne: row.type_campagne || null,
          date_debut: row.date_debut || null,
          date_fin_prevue: row.date_fin_prevue || null,
          statut: row.statut,
          description: row.description || null,
          actif: true,
          created_by: user?.id,
        },
      })
    })

    const { created, errorsByIndex } = await batchInsert<{ id_campagne: string }>(
      'campagnes', validRows.map(v => v.payload), 'id_campagne'
    )
    errorsByIndex.forEach((message, i) => errors.push({ row: validRows[i].origIndex + 2, message }))

    const auditEntries = validRows
      .map((v, i) => ({ v, row: created[i] }))
      .filter(({ row }) => row)
      .map(({ v, row }) => ({
        utilisateur: user?.id ?? null, action: 'IMPORT', table_concernee: 'campagnes',
        id_enregistrement: row!.id_campagne, nouvelles_valeurs: v.payload,
      }))
    await batchLogAudit(auditEntries)

    const inserted = created.filter(Boolean).length
    if (inserted > 0) {
      toast.success(`${inserted} campagne${inserted > 1 ? 's' : ''} importée${inserted > 1 ? 's' : ''}`)
      load()
    }
    return { total: rows.length, inserted, errors }
  }

  const columns: Column<Campagne>[] = [
    { key: 'nom', header: 'Nom de la campagne', sortable: true,
      render: r => <span className="font-medium text-gray-800">{r.nom}</span> },
    { key: 'type_campagne', header: 'Type' },
    { key: 'statut', header: 'Statut', render: r => <Badge value={r.statut} /> },
    { key: 'date_debut', header: 'Début', render: r => <span className="text-xs text-gray-500">{formatDate(r.date_debut)}</span> },
    { key: 'date_fin_prevue', header: 'Fin prévue', render: r => <span className="text-xs text-gray-500">{formatDate(r.date_fin_prevue)}</span> },
    { key: 'actions', header: '', className: 'w-24 text-right',
      render: r => (
        <div className="flex justify-end gap-1">
          <button onClick={() => navigate(`/campagnes/${r.id_campagne}`)} className="btn-icon" title="Suivi"><BarChart3 size={14} /></button>
          {isAssistant && <button onClick={() => { setEditing(r); reset({ nom: r.nom, description: r.description ?? '', type_campagne: r.type_campagne ?? '', date_debut: r.date_debut ?? '', date_fin_prevue: r.date_fin_prevue ?? '', statut: r.statut }); setModalOpen(true) }} className="btn-icon" title="Modifier"><Pencil size={14} /></button>}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Settings2 size={20} className="text-primary-700" />Campagnes de migration</h1>
          <p className="page-subtitle">{total} campagne{total > 1 ? 's' : ''}</p>
        </div>
        {isAssistant && <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-secondary text-sm gap-1.5"><Upload size={14} />Importer</button>
          <button onClick={() => { setEditing(null); reset({ nom: '', description: '', type_campagne: '', date_debut: '', date_fin_prevue: '', statut: 'Planifiée' }); setModalOpen(true) }} className="btn-primary text-sm gap-1.5"><Plus size={14} />Nouvelle campagne</button>
        </div>}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Nom de campagne…" className="flex-1 min-w-48" />
        <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1) }} className="input text-sm w-44">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_campagne} />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }}
        title={editing ? 'Modifier la campagne' : 'Nouvelle campagne'} size="lg"
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="camp-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="camp-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label label-required">Nom de la campagne</label>
            <input className={`input ${errors.nom ? 'input-error' : ''}`}
              placeholder="Ex: Migration Windows 11"
              {...register('nom', { required: 'Le nom est requis' })} />
            {errors.nom && <p className="mt-1 text-xs text-danger-700">{errors.nom.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input" {...register('type_campagne')}>
                <option value="">— Sélectionner —</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label label-required">Statut</label>
              <select className="input" {...register('statut', { required: true })}>
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date de début</label>
              <input type="date" className="input" {...register('date_debut')} />
            </div>
            <div>
              <label className="label">Date de fin prévue</label>
              <input type="date" className="input" {...register('date_fin_prevue')} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={3} className="input resize-none" {...register('description')} />
          </div>
        </form>
      </Modal>

      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer des campagnes depuis Excel"
        columns={IMPORT_COLUMNS}
        templateName="campagnes"
        templateExample={IMPORT_EXAMPLE}
        onImport={handleImport}
      />
    </div>
  )
}
