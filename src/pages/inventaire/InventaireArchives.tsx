import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, RotateCcw, ArrowLeft } from 'lucide-react'
import { supabase, logAudit } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Inventaire } from '@/types'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { ConfirmDialog } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export function InventaireArchives() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [data, setData] = useState<Inventaire[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [reactivateTarget, setReactivateTarget] = useState<Inventaire | null>(null)
  const [reactivateLoading, setReactivateLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase
      .from('inventaire')
      .select('*', { count: 'exact' })
      .eq('actif', false)
      .order('date_desactivation', { ascending: false })
      .range(from, from + pageSize - 1)
    if (search.trim()) {
      q = q.or(`numero_inventaire.ilike.%${search}%,utilisateur.ilike.%${search}%,numero_serie.ilike.%${search}%`)
    }
    const { data, count } = await q
    setData(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, pageSize, search])

  useEffect(() => { load() }, [load])

  async function handleReactivate() {
    if (!reactivateTarget) return
    setReactivateLoading(true)
    try {
      const { error } = await supabase
        .from('inventaire')
        .update({
          actif: true,
          motif_desactivation: null,
          date_desactivation: null,
          etat: 'En stock',
        })
        .eq('id_materiel', reactivateTarget.id_materiel)
      if (error) throw error
      await logAudit({
        action: 'REACTIVATION',
        table_concernee: 'inventaire',
        id_enregistrement: reactivateTarget.id_materiel,
        anciennes_valeurs: { actif: false },
        nouvelles_valeurs: { actif: true, etat: 'En stock' },
      })
      toast.success('Matériel réactivé')
      setReactivateTarget(null)
      load()
    } catch {
      toast.error('Erreur lors de la réactivation')
    } finally {
      setReactivateLoading(false)
    }
  }

  const columns: Column<Inventaire>[] = [
    { key: 'numero_inventaire', header: 'N° Inventaire', sortable: true,
      render: r => <span className="font-mono text-xs font-semibold text-gray-600">{r.numero_inventaire ?? '—'}</span> },
    { key: 'type_materiel',    header: 'Type' },
    { key: 'marque_modele',    header: 'Marque / Modèle' },
    { key: 'utilisateur',      header: 'Utilisateur' },
    { key: 'motif_desactivation', header: 'Motif désactivation' },
    { key: 'date_desactivation', header: 'Désactivé le',
      render: r => <span className="text-xs text-gray-500">{formatDate(r.date_desactivation)}</span> },
    { key: 'actions', header: '', className: 'w-24 text-right',
      render: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => navigate(`/inventaire/${r.id_materiel}`)} className="btn-icon" title="Voir">
            <Eye size={15} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setReactivateTarget(r)}
              className="btn-icon text-ok-500 hover:bg-ok-50 hover:text-ok-700"
              title="Réactiver"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <button onClick={() => navigate('/inventaire')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
            <ArrowLeft size={14} /> Inventaire
          </button>
          <h1 className="page-title">Archives / Matériels désactivés</h1>
          <p className="page-subtitle">{total} matériel{total > 1 ? 's' : ''} désactivé{total > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="card p-4">
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="N° inventaire, utilisateur, série…"
        />
      </div>

      <div className="card">
        <Table
          columns={columns} data={data} loading={loading}
          rowKey={r => r.id_materiel} emptyMessage="Aucun matériel désactivé."
        />
        <Pagination page={page} pageSize={pageSize} total={total}
          onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <ConfirmDialog
        open={!!reactivateTarget}
        onClose={() => setReactivateTarget(null)}
        onConfirm={handleReactivate}
        loading={reactivateLoading}
        title="Réactiver le matériel"
        message={`Voulez-vous réactiver "${reactivateTarget?.numero_inventaire ?? reactivateTarget?.id_materiel}" ? Son état sera défini sur "En stock".`}
        confirmLabel="Réactiver"
      />
    </div>
  )
}
