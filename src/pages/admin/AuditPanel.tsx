import { useState, useEffect, useCallback } from 'react'
import { History, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AuditLog } from '@/types'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { exportToExcel, formatDateTime } from '@/lib/utils'

const TABLES = ['inventaire', 'poste', 'systeme_exploitation', 'microsoft_office', 'campagnes', 'suivi_campagne', 'res_probleme', 'site_dualsim', 'tsp', 'deploiement_apk', 'suivi_di_ds']
const ACTIONS = ['CREATION', 'MODIFICATION', 'DESACTIVATION', 'REACTIVATION', 'SUPPRESSION']

export function AuditPanel() {
  const [data, setData] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('audit_logs').select('*', { count: 'exact' })
      .order('date_action', { ascending: false })
      .range(from, from + pageSize - 1)
    if (filterTable) q = q.eq('table_concernee', filterTable)
    if (filterAction) q = q.eq('action', filterAction)
    if (search.trim()) q = q.eq('id_enregistrement', search.trim())
    const { data, count } = await q
    setData(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, pageSize, search, filterTable, filterAction])

  useEffect(() => { load() }, [load])

  const actionColor: Record<string, string> = {
    CREATION: 'bg-green-100 text-green-700',
    MODIFICATION: 'bg-blue-100 text-blue-700',
    DESACTIVATION: 'bg-red-100 text-red-700',
    REACTIVATION: 'bg-teal-100 text-teal-700',
    SUPPRESSION: 'bg-red-200 text-red-800',
  }

  const columns: Column<AuditLog>[] = [
    { key: 'date_action', header: 'Date / Heure', render: r => <span className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(r.date_action)}</span> },
    { key: 'action', header: 'Action', render: r => <span className={`badge text-xs ${actionColor[r.action] ?? 'bg-gray-100 text-gray-600'}`}>{r.action}</span> },
    { key: 'table_concernee', header: 'Table', render: r => <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.table_concernee}</code> },
    { key: 'id_enregistrement', header: 'ID', render: r => <code className="text-xs text-gray-400 truncate max-w-[120px] block">{r.id_enregistrement}</code> },
    { key: 'utilisateur', header: 'Utilisateur', render: r => <span className="text-xs text-gray-500">{r.utilisateur ?? 'Système'}</span> },
    { key: 'details', header: '', className: 'w-16 text-right',
      render: r => (r.anciennes_valeurs || r.nouvelles_valeurs)
        ? <button onClick={() => setSelected(r)} className="text-xs text-primary-600 hover:underline">Détails</button>
        : null
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={17} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">{total} entrée{total > 1 ? 's' : ''} d'audit</span>
        </div>
        <button
          onClick={() => exportToExcel(data.map(r => ({ 'Date': formatDateTime(r.date_action), 'Action': r.action, 'Table': r.table_concernee, 'ID': r.id_enregistrement, 'Utilisateur': r.utilisateur ?? '' })), 'audit_logs')}
          className="btn-secondary text-sm gap-1.5"
        >
          <Download size={14} /> Exporter
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="ID enregistrement…" className="flex-1 min-w-48" />
        <select value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(1) }} className="input text-sm w-44">
          <option value="">Toutes les tables</option>
          {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }} className="input text-sm w-40">
          <option value="">Toutes les actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={data} loading={loading} rowKey={r => r.id_log} emptyMessage="Aucun log trouvé." />
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} pageSizeOptions={[25, 50, 100]} />
      </div>

      {/* Détail log */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold">Détail de l'action</h3>
              <button onClick={() => setSelected(null)} className="btn-icon text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Date</p><p>{formatDateTime(selected.date_action)}</p></div>
                <div><p className="text-xs text-gray-400">Action</p><span className={`badge ${actionColor[selected.action] ?? ''}`}>{selected.action}</span></div>
                <div><p className="text-xs text-gray-400">Table</p><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{selected.table_concernee}</code></div>
                <div><p className="text-xs text-gray-400">ID</p><code className="text-xs text-gray-500 break-all">{selected.id_enregistrement}</code></div>
              </div>
              {selected.anciennes_valeurs && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Anciennes valeurs</p>
                  <pre className="text-xs bg-red-50 border border-red-100 rounded-lg p-3 overflow-auto max-h-32 scrollbar-thin">
                    {JSON.stringify(selected.anciennes_valeurs, null, 2)}
                  </pre>
                </div>
              )}
              {selected.nouvelles_valeurs && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Nouvelles valeurs</p>
                  <pre className="text-xs bg-green-50 border border-green-100 rounded-lg p-3 overflow-auto max-h-32 scrollbar-thin">
                    {JSON.stringify(selected.nouvelles_valeurs, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
