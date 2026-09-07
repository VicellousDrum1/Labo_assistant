import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'yellow' | 'gray'
  subtitle?: string
  trend?: number // % évolution
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-700',   text: 'text-blue-700' },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-700', text: 'text-green-700' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-700',     text: 'text-red-700' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-700', text: 'text-orange-700' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-700', text: 'text-purple-700' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-700', text: 'text-yellow-700' },
  gray:   { bg: 'bg-gray-50',   icon: 'bg-gray-100 text-gray-700',   text: 'text-gray-700' },
}

export function KpiCard({ label, value, icon: Icon, color = 'blue', subtitle, trend }: KpiCardProps) {
  const c = colorMap[color]
  return (
    <div className={cn('card p-5 flex items-start gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md', c.bg)}>
      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm', c.icon)}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className={cn('text-3xl font-bold tracking-tight mt-0.5', c.text)}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        {trend !== undefined && (
          <p className={cn('text-xs mt-1 font-medium', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </p>
        )}
      </div>
    </div>
  )
}
