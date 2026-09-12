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
// Chaque statut est rattaché à une classe .badge-* sémantique (voir index.css).
// L'accent de marque (signal/ambre) n'est jamais utilisé ici : il reste réservé
// à la navigation et aux actions, pour ne pas mélanger "état du matériel" et "action".
export const statusColors: Record<string, string> = {
  'En service':          'badge-ok',
  'En panne':            'badge-danger',
  'Renouvelé':           'badge-info',
  'En réparation':       'badge-signal',
  'En stock':            'badge-muted',
  'Hors service':        'badge-danger',
  'Volé':                'badge-danger',
  'Réformé':             'badge-muted',
  'Déposé au Siège':     'badge-muted',
  // Migrations
  'Migré':               'badge-ok',
  'En cours de migration': 'badge-signal',
  'Non migré':           'badge-danger',
  // Campagnes
  'Planifiée':           'badge-info',
  'En cours':            'badge-signal',
  'Terminée':            'badge-ok',
  'Suspendue':           'badge-muted',
  'Annulée':             'badge-muted',
  // Suivi campagne
  'Non démarré':         'badge-muted',
  'Planifié':            'badge-info',
  'Terminé':             'badge-ok',
  'Échec':               'badge-danger',
  'Non éligible':        'badge-muted',
  // APK
  'Déployé':             'badge-ok',
  'Non déployé':         'badge-danger',
  // DI/DS
  'Nouveau':             'badge-info',
  'Affecté':             'badge-info',
  'En attente':          'badge-signal',
  'Résolu':              'badge-ok',
  'Clôturé':             'badge-muted',
  'Annulé':              'badge-muted',
  // Priorités
  'Faible':              'badge-muted',
  'Normale':             'badge-info',
  'Haute':               'badge-signal',
  'Critique':            'badge-danger',
}
