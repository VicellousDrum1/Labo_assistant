import { cn, statusColors } from '@/lib/utils'

interface BadgeProps {
  value: string | null | undefined
  className?: string
}

export function Badge({ value, className }: BadgeProps) {
  if (!value) return <span className="text-gray-400">—</span>
  const color = statusColors[value] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={cn('badge', color, className)}>
      {value}
    </span>
  )
}
