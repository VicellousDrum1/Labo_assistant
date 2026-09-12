import { cn, statusColors } from '@/lib/utils'

interface BadgeProps {
  value: string | null | undefined
  className?: string
}

export function Badge({ value, className }: BadgeProps) {
  if (!value) return <span className="text-gray-400">—</span>
  const color = statusColors[value] ?? 'badge-muted'
  return (
    <span className={cn('badge', color, className)}>
      <span className="badge-dot" />
      {value}
    </span>
  )
}
