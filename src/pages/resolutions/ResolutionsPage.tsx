import { useState, useEffect, useCallback } from 'react'
import { HelpCircle, Plus, Pencil, Trash2, Search, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { batchInsert, batchLogAudit } from '@/lib/importHelpers'
import { useAuth } from '@/context/AuthContext'
import { useReferentiels } from '@/hooks/useReferentiels'
import type { ResProbleme } from '@/types'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { ImportExcel, type ImportColumn, type ImportResult } from '@/components/ui/ImportExcel'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface FormData {
  probleme: string; solution_trouvee: string
  observation: string; categorie: string; mots_cles: string
}

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'probleme',         header: 'Problème',         required: true },
  { key: 'solution_trouvee', header: 'Solution trouvée', required: true },
  { key: 'categorie',        header: 'Catégorie',        required: false },
  { key: 'mots_cles',        header: 'Mots-clés',        required: false },
  { key: 'observation',      header: 'Observation',      required: false },
]
const IMPORT_EXAMPLE: Record<string, string> = {
  probleme: 'L\'imprimante ne répond plus au réseau',
  solution_trouvee: 'Redémarrer le service spouleur puis relancer la carte réseau de l\'imprimante',
  categorie: 'Imprimante',
  mots_cles: 'imprimante, réseau, spouleur',
  observation: '',
}

export function ResolutionsPage() {
  const { isAssistant, user } = useAuth()
  const refs = useReferentiels()
  const [data, setData] = useState<ResProbleme[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ResProbleme | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editing, setEditing] = useState<ResProbleme | null>(null)
  const [viewItem, setViewItem] = useState<ResProbleme | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('res_probleme').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, from + pageSize - 1)
    if (filterCat) q = q.eq('categorie', filterCat)
    if (search.trim()) q = q.or(`probleme.ilike.%${search}%,solution_trouvee.ilike.%${search}%,mots_cles.ilike.%${search}%`)
    const { data, count } = await q
    setData(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, pageSize, search, filterCat])

  useEffect(() => { load() }, [load])

  async function onSubmit(form: FormData) {
    try {
      if (editing) {
        await supabase.from('res_probleme').update(form).eq('id_resolution', editing.id_resolution)
        await logAudit({ action: 'MODIFICATION', table_concernee: 'res_probleme', id_enregistrement: editing.id_resolution, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Guide mis à jour')
      } else {
        const { data: created } = await supabase.from('res_probleme').insert({ ...form, created_by: user?.id }).select().single()
        if (created) await logAudit({ action: 'CREATION', table_concernee: 'res_probleme', id_enregistrement: created.id_resolution, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Solution enregistrée')
      }
      setModalOpen(false); reset(); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await supabase.from('res_probleme').delete().eq('id_resolution', deleteTarget.id_resolution)
      toast.success('Entrée supprimée')
      setDeleteTarget(null); load()
    } catch { toast.error('Erreur') }
    finally { setDeleteLoading(false) }
  }

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportResult> {
    const payloads = rows.map(row => ({
      probleme: row.probleme,
      solution_trouvee: row.solution_trouvee,
      categorie: row.categorie || null,
      mots_cles: row.mots_cles || null,
      observation: row.observation || null,
      created_by: user?.id,
    }))

    const { created, errorsByIndex } = await batchInsert<{ id_resolution: string }>(
      'res_probleme', payloads, 'id_resolution'
    )
    const errors: { row: number; message: string }[] = []
    errorsByIndex.forEach((message, i) => errors.push({ row: i + 2, message }))

    const auditEntries = created
      .map((c, i) => ({ c, payload: payloads[i] }))
      .filter(({ c }) => c)
      .map(({ c, payload }) => ({
        utilisateur: user?.id ?? null, action: 'IMPORT', table_concernee: 'res_probleme',
        id_enregistrement: c!.id_resolution, nouvelles_valeurs: payload,
      }))
    await batchLogAudit(auditEntries)

    const inserted = created.filter(Boolean).length
    if (inserted > 0) {
      toast.success(`${inserted} solution${inserted > 1 ? 's' : ''} importée${inserted > 1 ? 's' : ''}`)
      load()
    }
    return { total: rows.length, inserted, errors }
  }

  const columns: Column<ResProbleme>[] = [
    { key: 'probleme', header: 'Problème',
      render: r => (
        <button onClick={() => setViewItem(r)} className="text-left hover:text-primary-700 transition-colors">
          <p className="font-medium text-sm">{r.probleme.slice(0, 60)}{r.probleme.length > 60 ? '…' : ''}</p>
          {r.categorie && <span className="text-xs text-gray-400">{r.categorie}</span>}
        </button>
      )
    },
    { key: 'solution_trouvee', header: 'Solution',
      render: r => <p className="text-sm text-gray-600">{r.solution_trouvee.slice(0, 80)}{r.solution_trouvee.length > 80 ? '…' : ''}</p>
    },
    { key: 'mots_cles', header: 'Mots-clés',
      render: r => r.mots_cles ? (
        <div className="flex flex-wrap gap-1">
          {r.mots_cles.split(',').map(k => k.trim()).filter(Boolean).slice(0, 3).map(k => (
            <span key={k} className="badge bg-gray-100 text-gray-600 text-[10px]">{k}</span>
          ))}
        </div>
      ) : <span className="text-gray-300">—</span>
    },
    { key: 'created_at', header: 'Date', render: r => <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span> },
    { key: 'actions', header: '', className: 'w-20 text-right',
      render: r => isAssistant ? (
        <div className="flex justify-end gap-1">
          <button onClick={() => { setEditing(r); reset({ probleme: r.probleme, solution_trouvee: r.solution_trouvee, observation: r.observation ?? '', categorie: r.categorie ?? '', mots_cles: r.mots_cles ?? '' }); setModalOpen(true) }} className="btn-icon"><Pencil size={14} /></button>
          <button onClick={() => setDeleteTarget(r)} className="btn-icon text-danger-500 hover:text-danger-700 hover:bg-danger-50"><Trash2 size={14} /></button>
        </div>
      ) : null
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><HelpCircle size={20} className="text-primary-700" />Guide de résolution</h1>
          <p className="page-subtitle">{total} solution{total > 1 ? 's' : ''} documentée{total > 1 ? 's' : ''}</p>
        </div>
        {isAssistant && <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-secondary text-sm gap-1.5"><Upload size={14} />Importer</button>
          <button onClick={() => { setEditing(null); reset({ probleme: '', solution_trouvee: '', observation: '', categorie: '', mots_cles: '' }); setModalOpen(true) }} className="btn-primary text-sm gap-1.5"><Plus size={14} />Nouvelle solution</button>
        </div>}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Rechercher un problème, solution, mot-clé…" className="flex-1 min-w-56" autoFocus={false} />
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }} className="input text-sm w-44">
          <option value="">Toutes catégories</option>
          {refs.categoriesProbleme.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="card">
        {data.length === 0 && !loading
          ? <EmptyState icon={Search} title="Aucune solution trouvée" description="Documentez vos solutions techniques pour les retrouver facilement." action={isAssistant ? <button onClick={() => { setEditing(null); reset(); setModalOpen(true) }} className="btn-primary text-sm"><Plus size={14} />Ajouter une solution</button> : undefined} />
          : <>
              <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_resolution} />
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
            </>
        }
      </div>

      {/* Modal détail */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Détail de la solution" size="lg">
        {viewItem && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Problème</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewItem.probleme}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Solution</p>
              <div className="p-3 bg-ok-50 border border-ok-100 rounded-lg">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewItem.solution_trouvee}</p>
              </div>
            </div>
            {viewItem.observation && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Observation</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewItem.observation}</p>
              </div>
            )}
            <div className="flex gap-4 text-xs text-gray-400">
              {viewItem.categorie && <span>Catégorie : <strong className="text-gray-600">{viewItem.categorie}</strong></span>}
              {viewItem.mots_cles && <span>Mots-clés : <strong className="text-gray-600">{viewItem.mots_cles}</strong></span>}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal create/edit */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }}
        title={editing ? 'Modifier la solution' : 'Nouvelle solution'} size="xl"
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="res-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="res-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label label-required">Description du problème</label>
            <textarea rows={3} className={`input resize-none ${errors.probleme ? 'input-error' : ''}`} placeholder="Décrivez le problème rencontré…" {...register('probleme', { required: 'La description est requise' })} />
            {errors.probleme && <p className="mt-1 text-xs text-danger-700">{errors.probleme.message}</p>}
          </div>
          <div>
            <label className="label label-required">Solution trouvée</label>
            <textarea rows={4} className={`input resize-none ${errors.solution_trouvee ? 'input-error' : ''}`} placeholder="Décrivez la solution étape par étape…" {...register('solution_trouvee', { required: 'La solution est requise' })} />
            {errors.solution_trouvee && <p className="mt-1 text-xs text-danger-700">{errors.solution_trouvee.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Catégorie</label>
              <select className="input" {...register('categorie')}>
                <option value="">— Sélectionner —</option>
                {refs.categoriesProbleme.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mots-clés</label>
              <input className="input" placeholder="imprimante, réseau, wifi…" {...register('mots_cles')} />
            </div>
          </div>
          <div>
            <label className="label">Observation</label>
            <textarea rows={2} className="input resize-none" {...register('observation')} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        loading={deleteLoading} title="Supprimer la solution"
        message="Supprimer définitivement cette entrée du guide ?" confirmLabel="Supprimer" danger />

      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer le guide de résolution depuis Excel"
        columns={IMPORT_COLUMNS}
        templateName="res_probleme"
        templateExample={IMPORT_EXAMPLE}
        onImport={handleImport}
      />
    </div>
  )
}
