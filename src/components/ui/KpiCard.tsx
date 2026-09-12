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

// Le prop `color` reste inchangé pour compat avec les pages existantes,
// mais pointe désormais vers la palette colorée assumée du design system v3.
const colorMap = {
  blue:   'bg-blue-50 text-blue-500',
  green:  'bg-ok-50 text-ok-500',
  red:    'bg-danger-50 text-danger-500',
  orange: 'bg-amber-50 text-amber-500',
  purple: 'bg-info-50 text-info-500',
  yellow: 'bg-amber-50 text-amber-500',
  gray:   'bg-muted-50 text-muted-500',
}

export function KpiCard({ label, value, icon: Icon, color = 'blue', subtitle, trend }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className={cn('kpi-chip', colorMap[color])}>
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="data-value text-[22px] font-extrabold text-graphite leading-none">{value}</p>
        <p className="text-xs font-semibold text-slate mt-1.5 truncate">{label}</p>
        {subtitle && <p className="text-xs text-slate mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <p className={cn('text-xs mt-1 font-bold', trend >= 0 ? 'text-ok-700' : 'text-danger-700')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </p>
        )}
      </div>
    </div>
  )
}
