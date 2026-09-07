import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render?: (row: T) => React.ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  emptyMessage?: string
  rowKey: (row: T) => string
}

export function Table<T>({
  columns, data, loading, sortKey, sortDir, onSort,
  emptyMessage = 'Aucun enregistrement trouvé.', rowKey
}: TableProps<T>) {
  return (
    <div className="table-container bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50/90 border-b border-slate-200">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'px-5 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-[.08em]',
                  col.sortable && 'cursor-pointer select-none hover:bg-slate-100 transition-colors',
                  col.className
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? <ChevronUp size={12} className="text-primary-600" />
                        : <ChevronDown size={12} className="text-primary-600" />
                      : <ChevronsUpDown size={12} className="text-gray-400" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col.key} className="px-5 py-4">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-14 text-center text-slate-400 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr key={rowKey(row)} className="hover:bg-primary-50/35 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className={cn('px-5 py-4 text-slate-700', col.className)}>
                    {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
