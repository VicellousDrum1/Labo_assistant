import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
  label?: string
  required?: boolean
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  error, label, required, options, placeholder, className, ...props
}, ref) => {
  return (
    <div>
      {label && (
        <label className={cn('label', required && 'label-required')}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn('input bg-white', error && 'input-error', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger-700">{error}</p>}
    </div>
  )
})

Select.displayName = 'Select'
