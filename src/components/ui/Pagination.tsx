import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  page, pageSize, total, onPageChange, onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100]
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 rounded-b-2xl">
      {/* Info */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          {total === 0 ? '0' : `${from}–${to}`} sur <strong>{total}</strong>
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {pageSizeOptions.map(s => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}
      </div>

      {/* Boutons */}
      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onPageChange(1)} disabled={page === 1} title="Première page">
          <ChevronsLeft size={15} />
        </PageBtn>
        <PageBtn onClick={() => onPageChange(page - 1)} disabled={page === 1} title="Page précédente">
          <ChevronLeft size={15} />
        </PageBtn>

        <span className="px-3 py-1 text-sm font-medium text-gray-700">
          {page} / {totalPages}
        </span>

        <PageBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} title="Page suivante">
          <ChevronRight size={15} />
        </PageBtn>
        <PageBtn onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} title="Dernière page">
          <ChevronsRight size={15} />
        </PageBtn>
      </div>
    </div>
  )
}

function PageBtn({
  children, onClick, disabled, title
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-lg text-slate-600',
        'hover:bg-white hover:text-primary-700 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}
