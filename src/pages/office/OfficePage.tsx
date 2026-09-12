import { useState, useEffect, useCallback } from 'react'
import { FileText, Pencil, Plus, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { fetchLookupMap, fetchExistingSet, batchInsert, batchLogAudit } from '@/lib/importHelpers'
import { useAuth } from '@/context/AuthContext'
import type { MicrosoftOffice, Inventaire } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { ImportExcel, type ImportColumn, type ImportResult } from '@/components/ui/ImportExcel'
import { exportToExcel, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type OffWithInv = MicrosoftOffice & { inventaire: Inventaire }
type InvPick = Pick<Inventaire, 'id_materiel' | 'numero_inventaire' | 'marque_modele' | 'utilisateur'>
const STATUTS = ['Non migré', 'En cours de migration', 'Migré']

interface FormData { statut_office: string; observation: string }

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'numero_inventaire', header: 'N° Inventaire', required: true },
  { key: 'statut_office',     header: 'Statut Office', required: true,
    validate: v => STATUTS.includes(v) ? null : `Statut invalide : "${v}" (attendu : ${STATUTS.join(' / ')})` },
  { key: 'observation',       header: 'Observation',   required: false },
]
const IMPORT_EXAMPLE: Record<string, string> = {
  numero_inventaire: 'INV-2024-001',
  statut_office: 'Migré',
  observation: '',
}

export function OfficePage() {
  const { isAssistant, user } = useAuth()
  const [data, setData] = useState<OffWithInv[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OffWithInv | null>(null)
  const [addMaterielId, setAddMaterielId] = useState('')
  const [pcs, setPcs] = useState<InvPick[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const { register, handleSubmit, reset } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase
      .from('microsoft_office')
      .select(`*, inventaire:inventaire(id_materiel,numero_inventaire,marque_modele,utilisateur,societe,exploitation)`, { count: 'exact' })
      .order('date_modification', { ascending: false })
      .range(from, from + pageSize - 1)
    if (filterStatut) q = q.eq('statut_office', filterStatut)
    const { data, count } = await q
    let rows = (data as OffWithInv[]) ?? []
    if (search.trim()) {
      const s = search.toLowerCase()
      rows = rows.filter(r =>
        r.inventaire?.numero_inventaire?.toLowerCase().includes(s) ||
        r.inventaire?.utilisateur?.toLowerCase().includes(s)
      )
    }
    setData(rows)
    setTotal(search.trim() ? rows.length : (count ?? 0))
    setLoading(false)
  }, [page, pageSize, search, filterStatut])

  useEffect(() => { load() }, [load])

  async function loadPCs() {
    const { data: existing } = await supabase.from('microsoft_office').select('id_materiel')
    const existingIds = existing?.map(r => r.id_materiel) ?? []
    let q = supabase.from('inventaire')
      .select('id_materiel,numero_inventaire,marque_modele,utilisateur')
      .in('type_materiel', ['Ordinateur de bureau', 'Ordinateur portable'])
      .eq('actif', true).order('numero_inventaire')
    if (existingIds.length) q = q.not('id_materiel', 'in', `(${existingIds.map(id => `"${id}"`).join(',')})`)
    const { data } = await q
    setPcs(data ?? [])
  }

  async function onSubmit(form: FormData) {
    try {
      if (editing) {
        await supabase.from('microsoft_office')
          .update({ statut_office: form.statut_office, observation: form.observation, date_modification: new Date().toISOString() })
          .eq('id_microsoft', editing.id_microsoft)
        await logAudit({ action: 'MODIFICATION', table_concernee: 'microsoft_office', id_enregistrement: editing.id_microsoft, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Statut Office mis à jour')
      } else {
        if (!addMaterielId) { toast.error('Sélectionner un matériel'); return }
        const { data: created } = await supabase.from('microsoft_office')
          .insert({ id_materiel: addMaterielId, statut_office: form.statut_office, observation: form.observation })
          .select().single()
        if (created) await logAudit({ action: 'CREATION', table_concernee: 'microsoft_office', id_enregistrement: created.id_microsoft, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Suivi Office créé')
      }
      setModalOpen(false); reset(); setAddMaterielId(''); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportResult> {
    const numInvValues = rows.map(r => String(r.numero_inventaire ?? '').trim())
    const materielMap = await fetchLookupMap<{ id_materiel: string }>(
      'inventaire', 'numero_inventaire', numInvValues, 'id_materiel,numero_inventaire'
    )
    const existingOff = await fetchExistingSet(
      'microsoft_office', 'id_materiel', [...materielMap.values()].map(m => m.id_materiel)
    )

    const errors: { row: number; message: string }[] = []
    const seenMateriel = new Set<string>()
    const validRows: { origIndex: number; payload: Record<string, unknown> }[] = []

    rows.forEach((row, i) => {
      const numInv = String(row.numero_inventaire ?? '').trim()
      const materiel = materielMap.get(numInv)
      if (!materiel) {
        errors.push({ row: i + 2, message: `Matériel "${numInv}" introuvable dans l'inventaire` }); return
      }
      if (existingOff.has(materiel.id_materiel)) {
        errors.push({ row: i + 2, message: `Un suivi Office existe déjà pour "${numInv}"` }); return
      }
      if (seenMateriel.has(materiel.id_materiel)) {
        errors.push({ row: i + 2, message: `"${numInv}" en double dans le fichier` }); return
      }
      seenMateriel.add(materiel.id_materiel)
      validRows.push({
        origIndex: i,
        payload: { id_materiel: materiel.id_materiel, statut_office: row.statut_office, observation: row.observation || null },
      })
    })

    const { created, errorsByIndex } = await batchInsert<{ id_microsoft: string }>(
      'microsoft_office', validRows.map(v => v.payload), 'id_microsoft'
    )
    errorsByIndex.forEach((message, i) => errors.push({ row: validRows[i].origIndex + 2, message }))

    const auditEntries = validRows
      .map((v, i) => ({ v, row: created[i] }))
      .filter(({ row }) => row)
      .map(({ v, row }) => ({
        utilisateur: user?.id ?? null, action: 'IMPORT', table_concernee: 'microsoft_office',
        id_enregistrement: row!.id_microsoft, nouvelles_valeurs: v.payload,
      }))
    await batchLogAudit(auditEntries)

    const inserted = created.filter(Boolean).length
    if (inserted > 0) {
      toast.success(`${inserted} suivi${inserted > 1 ? 's' : ''} Office importé${inserted > 1 ? 's' : ''}`)
      load()
    }
    return { total: rows.length, inserted, errors }
  }

  const kpi = {
    total: total,
    migres: data.filter(r => r.statut_office === 'Migré').length,
    enCours: data.filter(r => r.statut_office === 'En cours de migration').length,
    nonMigres: data.filter(r => r.statut_office === 'Non migré').length,
  }

  const columns: Column<OffWithInv>[] = [
    { key: 'numero_inventaire', header: 'N° Inventaire', render: r => <span className="font-mono text-xs text-primary-700 font-semibold">{r.inventaire?.numero_inventaire ?? '—'}</span> },
    { key: 'marque_modele', header: 'Modèle', render: r => r.inventaire?.marque_modele ?? '—' },
    { key: 'utilisateur', header: 'Utilisateur', render: r => r.inventaire?.utilisateur ?? '—' },
    { key: 'societe', header: 'Société', render: r => r.inventaire?.societe ?? '—' },
    { key: 'exploitation', header: 'Exploitation', render: r => r.inventaire?.exploitation ?? '—' },
    { key: 'statut_office', header: 'Statut Office', render: r => <Badge value={r.statut_office} /> },
    { key: 'date_modification', header: 'Mis à jour', render: r => <span className="text-xs text-gray-500">{formatDate(r.date_modification)}</span> },
    { key: 'actions', header: '', className: 'w-16 text-right',
      render: r => isAssistant ? <button onClick={() => { setEditing(r); reset({ statut_office: r.statut_office, observation: r.observation ?? '' }); setModalOpen(true) }} className="btn-icon"><Pencil size={14} /></button> : null },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><FileText size={20} className="text-primary-700" />Microsoft Office</h1>
          <p className="page-subtitle">Suivi des migrations Office</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(data.map(r => ({ 'N° Inv': r.inventaire?.numero_inventaire ?? '', 'Utilisateur': r.inventaire?.utilisateur ?? '', 'Statut': r.statut_office, 'Mis à jour': formatDate(r.date_modification) })), 'microsoft_office')} className="btn-secondary text-sm">Exporter</button>
          {isAssistant && <button onClick={() => setImportOpen(true)} className="btn-secondary text-sm gap-1.5"><Upload size={14} />Importer</button>}
          {isAssistant && <button onClick={() => { setEditing(null); reset({ statut_office: 'Non migré', observation: '' }); loadPCs(); setModalOpen(true) }} className="btn-primary text-sm gap-1.5"><Plus size={14} />Ajouter</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{ label: 'Total', value: kpi.total, c: 'bg-info-50 text-info-700' }, { label: 'Migrés', value: kpi.migres, c: 'bg-ok-50 text-ok-700' }, { label: 'En cours', value: kpi.enCours, c: 'bg-amber-50 text-amber-700' }, { label: 'Non migrés', value: kpi.nonMigres, c: 'bg-danger-50 text-danger-700' }]
          .map(k => <div key={k.label} className={`card p-4 ${k.c}`}><p className="text-xs font-medium text-gray-500 uppercase">{k.label}</p><p className="text-2xl font-bold mt-1">{k.value}</p></div>)}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="N° inventaire, utilisateur…" className="flex-1 min-w-48" />
        <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1) }} className="input text-sm w-52">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_microsoft} />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); setAddMaterielId('') }}
        title={editing ? `Modifier Office — ${editing.inventaire?.numero_inventaire}` : 'Nouveau suivi Office'}
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="off-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="off-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <label className="label label-required">Statut Office</label>
            <select className="input" {...register('statut_office')}>
              {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Observation</label>
            <textarea rows={3} className="input resize-none" {...register('observation')} />
          </div>
        </form>
      </Modal>

      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer les statuts Office depuis Excel"
        columns={IMPORT_COLUMNS}
        templateName="microsoft_office"
        templateExample={IMPORT_EXAMPLE}
        onImport={handleImport}
      />
    </div>
  )
}
