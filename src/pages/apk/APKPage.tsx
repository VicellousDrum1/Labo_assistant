import { useState, useEffect, useCallback } from 'react'
import { Download, Pencil, Plus, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { withTimeout, batchInsert, batchLogAudit, fetchExistingSet, chunk } from '@/lib/importHelpers'
import { useAuth } from '@/context/AuthContext'
import type { DeploiementApk, TSP } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { ImportExcel, type ImportColumn, type ImportResult } from '@/components/ui/ImportExcel'
import { exportToExcel, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type ApkWithTsp = DeploiementApk & { tsp: TSP }
const STATUTS = ['Non déployé', 'En cours', 'Déployé']

interface FormData { statut_deploiement: string; observation: string }

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'matricule',          header: 'Matricule TSP',    required: true },
  { key: 'statut_deploiement', header: 'Statut déploiement', required: true,
    validate: v => STATUTS.includes(v) ? null : `Statut invalide : "${v}" (attendu : ${STATUTS.join(' / ')})` },
  { key: 'observation',        header: 'Observation',      required: false },
]
const IMPORT_EXAMPLE: Record<string, string> = {
  matricule: 'M12345',
  statut_deploiement: 'Déployé',
  observation: '',
}

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
  const [importOpen, setImportOpen] = useState(false)
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

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportResult> {
    // Récupération en masse de tous les TSP actifs dont le matricule apparaît
    // dans le fichier, pour détecter en mémoire les matricules absents ou
    // ambigus (plusieurs TSP avec le même matricule) sans requête par ligne.
    const matricules = [...new Set(rows.map(r => String(r.matricule ?? '').trim()).filter(Boolean))]
    const byMatricule = new Map<string, { id_tsp: string }[]>()
    for (const batch of chunk(matricules)) {
      const { data } = await withTimeout<{ data: { id_tsp: string; matricule: string }[] | null }>(
        supabase.from('tsp').select('id_tsp, matricule').in('matricule', batch).eq('actif', true)
      )
      data?.forEach(r => {
        const list = byMatricule.get(r.matricule) ?? []
        list.push({ id_tsp: r.id_tsp })
        byMatricule.set(r.matricule, list)
      })
    }
    const existingDeploiements = await fetchExistingSet(
      'deploiement_apk', 'id_tsp',
      [...byMatricule.values()].flat().map(t => t.id_tsp)
    )

    const errors: { row: number; message: string }[] = []
    const seenTsp = new Set<string>()
    const validRows: { origIndex: number; payload: Record<string, unknown> }[] = []

    rows.forEach((row, i) => {
      const matricule = String(row.matricule ?? '').trim()
      const matches = byMatricule.get(matricule) ?? []
      if (matches.length === 0) {
        errors.push({ row: i + 2, message: `TSP avec matricule "${matricule}" introuvable` }); return
      }
      if (matches.length > 1) {
        errors.push({ row: i + 2, message: `Plusieurs TSP correspondent au matricule "${matricule}", import ignoré` }); return
      }
      const idTsp = matches[0].id_tsp
      if (existingDeploiements.has(idTsp)) {
        errors.push({ row: i + 2, message: `Un déploiement APK existe déjà pour "${matricule}"` }); return
      }
      if (seenTsp.has(idTsp)) {
        errors.push({ row: i + 2, message: `"${matricule}" en double dans le fichier` }); return
      }
      seenTsp.add(idTsp)
      validRows.push({
        origIndex: i,
        payload: {
          id_tsp: idTsp,
          statut_deploiement: row.statut_deploiement,
          observation: row.observation || null,
          deployed_by: user?.id,
          date_deploiement: row.statut_deploiement === 'Déployé' ? new Date().toISOString() : null,
        },
      })
    })

    const { created, errorsByIndex } = await batchInsert<{ id_deploiement: string }>(
      'deploiement_apk', validRows.map(v => v.payload), 'id_deploiement'
    )
    errorsByIndex.forEach((message, i) => errors.push({ row: validRows[i].origIndex + 2, message }))

    const auditEntries = validRows
      .map((v, i) => ({ v, row: created[i] }))
      .filter(({ row }) => row)
      .map(({ v, row }) => ({
        utilisateur: user?.id ?? null, action: 'IMPORT', table_concernee: 'deploiement_apk',
        id_enregistrement: row!.id_deploiement, nouvelles_valeurs: v.payload,
      }))
    await batchLogAudit(auditEntries)

    const inserted = created.filter(Boolean).length
    if (inserted > 0) {
      toast.success(`${inserted} déploiement${inserted > 1 ? 's' : ''} importé${inserted > 1 ? 's' : ''}`)
      load()
    }
    return { total: rows.length, inserted, errors }
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
          {isAssistant && <button onClick={() => setImportOpen(true)} className="btn-secondary text-sm gap-1.5"><Upload size={14} />Importer</button>}
          {isAssistant && <button onClick={() => { setEditing(null); reset({ statut_deploiement: 'Non déployé', observation: '' }); loadTSP(); setAddTspId(''); setModalOpen(true) }} className="btn-primary text-sm gap-1.5"><Plus size={14} />Ajouter</button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Déployés', v: statMap['Déployé'], c: 'bg-ok-50 text-ok-700' }, { l: 'Non déployés', v: statMap['Non déployé'], c: 'bg-danger-50 text-danger-700' }, { l: 'En cours', v: statMap['En cours'], c: 'bg-amber-50 text-amber-700' }]
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

      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer les déploiements APK depuis Excel"
        columns={IMPORT_COLUMNS}
        templateName="deploiement_apk"
        templateExample={IMPORT_EXAMPLE}
        onImport={handleImport}
      />
    </div>
  )
}
