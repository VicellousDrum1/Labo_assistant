import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---- EXPORT EXCEL ----
export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Données')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ---- EXPORT CSV ----
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h]
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---- EXPORT PDF ----
export function exportToPDF(
  columns: string[],
  rows: (string | number | null | undefined)[][],
  filename: string,
  title: string
) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(title, 14, 15)
  doc.setFontSize(9)
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 22)
  autoTable(doc, {
    head: [columns],
    body: rows.map(r => r.map(c => c ?? '')),
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  })
  doc.save(`${filename}.pdf`)
}

// ---- DEBOUNCE ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

// ---- STATUT COLORS ----
export const statusColors: Record<string, string> = {
  'En service':          'bg-green-100 text-green-800',
  'En panne':            'bg-red-100 text-red-800',
  'Renouvelé':           'bg-blue-100 text-blue-800',
  'En réparation':       'bg-orange-100 text-orange-800',
  'En stock':            'bg-gray-100 text-gray-800',
  'Hors service':        'bg-red-200 text-red-900',
  'Réformé':             'bg-purple-100 text-purple-800',
  'Déposé au Siège':     'bg-yellow-100 text-yellow-800',
  // Migrations
  'Migré':               'bg-green-100 text-green-800',
  'En cours de migration': 'bg-orange-100 text-orange-800',
  'Non migré':           'bg-red-100 text-red-800',
  // Campagnes
  'Planifiée':           'bg-blue-100 text-blue-800',
  'En cours':            'bg-orange-100 text-orange-800',
  'Terminée':            'bg-green-100 text-green-800',
  'Suspendue':           'bg-yellow-100 text-yellow-800',
  'Annulée':             'bg-gray-100 text-gray-800',
  // Suivi campagne
  'Non démarré':         'bg-gray-100 text-gray-700',
  'Planifié':            'bg-blue-100 text-blue-800',
  'Terminé':             'bg-green-100 text-green-800',
  'Échec':               'bg-red-100 text-red-800',
  'Non éligible':        'bg-gray-200 text-gray-600',
  // APK
  'Déployé':             'bg-green-100 text-green-800',
  'Non déployé':         'bg-red-100 text-red-800',
  // DI/DS
  'Nouveau':             'bg-blue-100 text-blue-800',
  'Affecté':             'bg-indigo-100 text-indigo-800',
  'En attente':          'bg-yellow-100 text-yellow-800',
  'Résolu':              'bg-green-100 text-green-800',
  'Clôturé':             'bg-gray-100 text-gray-600',
  'Annulé':              'bg-gray-200 text-gray-600',
  // Priorités
  'Faible':              'bg-gray-100 text-gray-600',
  'Normale':             'bg-blue-100 text-blue-700',
  'Haute':               'bg-orange-100 text-orange-800',
  'Critique':            'bg-red-100 text-red-800',
}
