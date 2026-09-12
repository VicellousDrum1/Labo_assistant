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
    <div className="table-container">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-canvas-a">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3.5 text-left text-[11px] font-extrabold text-slate uppercase tracking-wide',
                  col.sortable && 'cursor-pointer select-none hover:bg-canvas-b transition-colors',
                  col.className
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? <ChevronUp size={12} className="text-amber-500" />
                        : <ChevronDown size={12} className="text-amber-500" />
                      : <ChevronsUpDown size={12} className="text-slate-light" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-canvas-a rounded-lg animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate text-sm font-medium">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr key={rowKey(row)} className="hover:bg-canvas-a transition-colors">
                {columns.map(col => (
                  <td key={col.key} className={cn('px-4 py-3 text-graphite', col.className)}>
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
