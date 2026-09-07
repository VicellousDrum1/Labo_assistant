import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Laptop } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, logAudit } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useReferentiels } from '@/hooks/useReferentiels'
import type { Poste, Inventaire } from '@/types'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { exportToExcel } from '@/lib/utils'
import toast from 'react-hot-toast'

type PosteWithInv = Poste & { inventaire: Inventaire }
type InvPick = Pick<Inventaire, 'id_materiel' | 'numero_inventaire' | 'marque_modele' | 'utilisateur'>

interface FormData {
  id_materiel: string
  fonction: string
  type_utilisation: string
  observation: string
}

const TYPES_UTILISATION = ['Standard', 'Bureautique', 'Technique', 'Direction', 'Mobile', 'Serveur', 'Autre']

export function PostesPage() {
  const { isAssistant } = useAuth()
  const refs = useReferentiels()
  const [data, setData] = useState<PosteWithInv[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PosteWithInv | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PosteWithInv | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [pcsAvailable, setPcsAvailable] = useState<InvPick[]>([])
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase
      .from('poste')
      .select(`*, inventaire:inventaire(id_materiel,numero_inventaire,marque_modele,utilisateur,societe,exploitation,type_materiel)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (search.trim()) {
      // Filtre après sur le résultat (pas de join filter direct en supabase anon)
    }
    const { data, count } = await q
    let rows = (data as PosteWithInv[]) ?? []
    if (search.trim()) {
      const s = search.toLowerCase()
      rows = rows.filter(r =>
        r.inventaire?.numero_inventaire?.toLowerCase().includes(s) ||
        r.inventaire?.utilisateur?.toLowerCase().includes(s) ||
        r.fonction?.toLowerCase().includes(s)
      )
    }
    setData(rows)
    setTotal(search.trim() ? rows.length : (count ?? 0))
    setLoading(false)
  }, [page, pageSize, search])

  useEffect(() => { load() }, [load])

  async function loadPCs() {
    const { data } = await supabase
      .from('inventaire')
      .select('id_materiel,numero_inventaire,marque_modele,utilisateur')
      .in('type_materiel', ['Ordinateur de bureau', 'Ordinateur portable'])
      .eq('actif', true)
      .order('numero_inventaire')
    setPcsAvailable(data ?? [])
  }

  function openCreate() {
    setEditing(null)
    reset({ id_materiel: '', fonction: '', type_utilisation: '', observation: '' })
    loadPCs()
    setModalOpen(true)
  }

  function openEdit(row: PosteWithInv) {
    setEditing(row)
    reset({
      id_materiel: row.id_materiel,
      fonction: row.fonction ?? '',
      type_utilisation: row.type_utilisation ?? '',
      observation: row.observation ?? '',
    })
    loadPCs()
    setModalOpen(true)
  }

  async function onSubmit(form: FormData) {
    try {
      if (editing) {
        const { error } = await supabase.from('poste').update({
          fonction: form.fonction, type_utilisation: form.type_utilisation, observation: form.observation,
        }).eq('id_poste', editing.id_poste)
        if (error) throw error
        await logAudit({ action: 'MODIFICATION', table_concernee: 'poste', id_enregistrement: editing.id_poste, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Poste mis à jour')
      } else {
        const { data: existing } = await supabase.from('poste').select('id_poste').eq('id_materiel', form.id_materiel).single()
        if (existing) { toast.error('Ce matériel a déjà un poste enregistré'); return }
        const { data: created, error } = await supabase.from('poste').insert(form).select().single()
        if (error) throw error
        await logAudit({ action: 'CREATION', table_concernee: 'poste', id_enregistrement: created.id_poste, nouvelles_valeurs: form as unknown as Record<string, unknown> })
        toast.success('Poste créé')
      }
      setModalOpen(false)
      reset()
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const { error } = await supabase.from('poste').delete().eq('id_poste', deleteTarget.id_poste)
      if (error) throw error
      await logAudit({ action: 'SUPPRESSION', table_concernee: 'poste', id_enregistrement: deleteTarget.id_poste })
      toast.success('Poste supprimé')
      setDeleteTarget(null)
      load()
    } catch { toast.error('Erreur lors de la suppression') }
    finally { setDeleteLoading(false) }
  }

  const columns: Column<PosteWithInv>[] = [
    { key: 'numero_inventaire', header: 'N° Inventaire',
      render: r => <span className="font-mono text-xs text-primary-700 font-semibold">{r.inventaire?.numero_inventaire ?? '—'}</span> },
    { key: 'type_materiel', header: 'Type',
      render: r => <span className="text-xs">{r.inventaire?.type_materiel}</span> },
    { key: 'marque_modele', header: 'Marque / Modèle', render: r => r.inventaire?.marque_modele ?? '—' },
    { key: 'utilisateur', header: 'Utilisateur', render: r => r.inventaire?.utilisateur ?? '—' },
    { key: 'fonction', header: 'Fonction' },
    { key: 'type_utilisation', header: 'Type utilisation' },
    { key: 'actions', header: '', className: 'w-20 text-right',
      render: r => isAssistant ? (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(r)} className="btn-icon" title="Modifier"><Pencil size={14} /></button>
          <button onClick={() => setDeleteTarget(r)} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50" title="Supprimer"><Trash2 size={14} /></button>
        </div>
      ) : null
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Laptop size={20} className="text-primary-700" />Postes / Fonctions</h1>
          <p className="page-subtitle">{total} poste{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(data.map(r => ({
            'N° Inventaire': r.inventaire?.numero_inventaire ?? '',
            'Utilisateur': r.inventaire?.utilisateur ?? '',
            'Fonction': r.fonction ?? '',
            'Type utilisation': r.type_utilisation ?? '',
            'Observation': r.observation ?? '',
          })), 'postes')} className="btn-secondary text-sm">Exporter</button>
          {isAssistant && <button onClick={openCreate} className="btn-primary text-sm gap-1.5"><Plus size={14} />Nouveau poste</button>}
        </div>
      </div>

      <div className="card p-4">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="N° inventaire, utilisateur, fonction…" />
      </div>

      <div className="card">
        {data.length === 0 && !loading
          ? <EmptyState icon={Laptop} title="Aucun poste enregistré" description="Associez des postes aux ordinateurs de votre inventaire." action={isAssistant ? <button onClick={openCreate} className="btn-primary text-sm"><Plus size={14} />Nouveau poste</button> : undefined} />
          : <>
              <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_poste} />
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
            </>
        }
      </div>

      {/* Modal create/edit */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }} title={editing ? 'Modifier le poste' : 'Nouveau poste'}
        footer={<>
          <button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button>
          <button form="poste-form" type="submit" className="btn-primary"><Pencil size={14} />{editing ? 'Enregistrer' : 'Créer'}</button>
        </>}>
        <form id="poste-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editing && (
            <div>
              <label className="label label-required">Matériel (PC)</label>
              <select className={`input ${errors.id_materiel ? 'input-error' : ''}`}
                {...register('id_materiel', { required: 'Sélectionner un matériel' })}>
                <option value="">— Sélectionner un PC —</option>
                {pcsAvailable.map(pc => <option key={pc.id_materiel} value={pc.id_materiel}>{pc.numero_inventaire} — {pc.marque_modele} ({pc.utilisateur ?? 'Sans utilisateur'})</option>)}
              </select>
              {errors.id_materiel && <p className="mt-1 text-xs text-red-600">{errors.id_materiel.message}</p>}
            </div>
          )}
          <div>
            <label className="label">Fonction du poste</label>
            <select className="input" {...register('fonction')}>
              <option value="">— Sélectionner —</option>
              {refs.fonctions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type d'utilisation</label>
            <select className="input" {...register('type_utilisation')}>
              <option value="">— Sélectionner —</option>
              {TYPES_UTILISATION.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Observation</label>
            <textarea rows={3} className="input resize-none" {...register('observation')} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteLoading}
        title="Supprimer le poste" message={`Supprimer le poste associé à "${deleteTarget?.inventaire?.numero_inventaire}" ?`}
        confirmLabel="Supprimer" danger />
    </div>
  )
}
