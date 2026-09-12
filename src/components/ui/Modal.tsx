import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  footer?: React.ReactNode
}

const sizes = {
  sm:  'max-w-sm',
  md:  'max-w-md',
  lg:  'max-w-lg',
  xl:  'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className={cn(
        'relative bg-white rounded-3xl shadow-soft w-full animate-fade-in',
        sizes[size],
        'max-h-[90vh] flex flex-col'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-extrabold text-graphite">{title}</h3>
          <button
            onClick={onClose}
            className="btn-icon bg-canvas-a ml-2"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-canvas-a rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Dialogue de confirmation
interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirmer', danger = false, loading = false
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={loading}>Annuler</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate font-medium">{message}</p>
    </Modal>
  )
}
