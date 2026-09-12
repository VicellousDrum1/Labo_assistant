import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-canvas-a rounded-3xl flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate" />
      </div>
      <h3 className="text-base font-extrabold text-graphite mb-1">{title}</h3>
      {description && <p className="text-sm text-slate max-w-xs font-medium">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
