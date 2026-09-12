import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Modal } from './Modal'

// ---- Types ----
export interface ImportColumn {
  key: string          // clé dans l'objet de sortie
  header: string       // nom exact dans l'Excel (modèle)
  required?: boolean
  validate?: (v: string) => string | null  // retourne message d'erreur ou null
  transform?: (v: string) => unknown       // transformation avant insertion
}

export interface ImportResult {
  total: number
  inserted: number
  errors: { row: number; message: string }[]
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  columns: ImportColumn[]
  templateName: string
  /** Reçoit les lignes validées, retourne le résultat */
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportResult>
  /** Données exemple pour le modèle (1 ligne optionnelle) */
  templateExample?: Record<string, string>
}

type Step = 'upload' | 'preview' | 'result'

export function ImportExcel({ open, onClose, title, columns, templateName, onImport, templateExample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)

  function reset() {
    setStep('upload')
    setFileName('')
    setRows([])
    setParseErrors([])
    setResult(null)
    setImporting(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  // ---- Télécharger le modèle ----
  function downloadTemplate() {
    const headers = columns.map(c => c.header)
    const example = templateExample
      ? [columns.map(c => templateExample[c.key] ?? '')]
      : []
    const ws = XLSX.utils.aoa_to_sheet([headers, ...example])

    // Style entête (gras + fond bleu)
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })]
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '20255C' } },
          alignment: { horizontal: 'center' },
        }
      }
    }

    // Largeur colonnes auto
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Données')
    XLSX.writeFile(wb, `${templateName}_modele.xlsx`)
  }

  // ---- Lire et valider le fichier ----
  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]

        if (raw.length < 2) {
          setParseErrors([{ row: 0, message: 'Le fichier est vide ou ne contient pas de données.' }])
          setStep('preview')
          return
        }

        // Première ligne = en-têtes
        const fileHeaders = raw[0].map(h => String(h).trim())
        const errors: { row: number; message: string }[] = []

        // Vérifier les colonnes requises
        const missingCols = columns
          .filter(c => c.required)
          .filter(c => !fileHeaders.includes(c.header))
          .map(c => c.header)
        if (missingCols.length) {
          setParseErrors([{ row: 0, message: `Colonnes manquantes : ${missingCols.join(', ')}` }])
          setStep('preview')
          return
        }

        // Mapper les index
        const colIndexes: Record<string, number> = {}
        columns.forEach(c => {
          const idx = fileHeaders.indexOf(c.header)
          if (idx >= 0) colIndexes[c.key] = idx
        })

        // Valider et transformer chaque ligne
        const validRows: Record<string, unknown>[] = []
        for (let i = 1; i < raw.length; i++) {
          const rawRow = raw[i]
          // Ignorer lignes vides
          if (rawRow.every(cell => String(cell).trim() === '')) continue

          const rowErrors: string[] = []
          const obj: Record<string, unknown> = {}

          columns.forEach(c => {
            const idx = colIndexes[c.key]
            const raw_val = idx !== undefined ? String(rawRow[idx] ?? '').trim() : ''

            if (c.required && !raw_val) {
              rowErrors.push(`"${c.header}" est requis`)
            } else if (c.validate && raw_val) {
              const err = c.validate(raw_val)
              if (err) rowErrors.push(err)
            }

            obj[c.key] = c.transform ? c.transform(raw_val) : (raw_val || null)
          })

          if (rowErrors.length) {
            errors.push({ row: i + 1, message: rowErrors.join(' · ') })
          } else {
            validRows.push(obj)
          }
        }

        setRows(validRows)
        setParseErrors(errors)
        setStep('preview')
      } catch {
        setParseErrors([{ row: 0, message: 'Impossible de lire le fichier. Vérifiez qu\'il s\'agit d\'un fichier Excel (.xlsx).' }])
        setStep('preview')
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    setImporting(true)
    try {
      const res = await onImport(rows)
      setResult(res)
      setStep('result')
    } catch (e: unknown) {
      setResult({
        total: rows.length,
        inserted: 0,
        errors: [{ row: 0, message: e instanceof Error ? e.message : 'Erreur inconnue' }],
      })
      setStep('result')
    } finally {
      setImporting(false)
    }
  }

  // ---- Drag & drop ----
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="lg"
      footer={
        step === 'upload' ? (
          <button onClick={handleClose} className="btn-secondary">Annuler</button>
        ) : step === 'preview' ? (
          <div className="flex gap-2 w-full justify-between">
            <button onClick={reset} className="btn-secondary">← Retour</button>
            <div className="flex gap-2">
              <button onClick={handleClose} className="btn-secondary">Annuler</button>
              <button
                onClick={handleImport}
                disabled={rows.length === 0 || importing}
                className="btn-primary gap-2"
              >
                {importing
                  ? <><Loader2 size={14} className="animate-spin" /> Import en cours…</>
                  : <><Upload size={14} /> Importer {rows.length} ligne{rows.length > 1 ? 's' : ''}</>}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleClose} className="btn-primary">Fermer</button>
        )
      }
    >
      {/* ÉTAPE 1 : Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Télécharger le modèle */}
          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div>
              <p className="text-sm font-medium text-amber-700">Modèle Excel</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Téléchargez le modèle, remplissez-le, puis importez-le.
              </p>
            </div>
            <button onClick={downloadTemplate} className="btn-primary text-sm gap-2 flex-shrink-0">
              <Download size={14} /> Télécharger le modèle
            </button>
          </div>

          {/* Zone de dépôt */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center
                       hover:border-amber-400 hover:bg-amber-50/30 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <Upload size={32} className="text-slate-light mx-auto mb-3" />
            <p className="text-sm font-bold text-graphite">
              Glissez votre fichier ici ou <span className="text-amber-700 underline">parcourir</span>
            </p>
            <p className="text-xs text-slate mt-1 font-medium">Formats acceptés : .xlsx, .xls</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
          </div>

          {/* Colonnes attendues */}
          <div>
            <p className="text-xs font-extrabold text-slate uppercase tracking-wide mb-2">
              Colonnes du modèle
            </p>
            <div className="flex flex-wrap gap-1.5">
              {columns.map(c => (
                <span key={c.key}
                  className={`text-xs px-2 py-0.5 rounded-full ${c.required
                    ? 'bg-amber-100 text-amber-700 font-medium'
                    : 'bg-canvas-a text-slate font-semibold'}`}>
                  {c.header}{c.required ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate mt-1.5 font-medium">* Champs obligatoires</p>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 : Aperçu / Validation */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate font-medium">
            <span className="font-bold text-graphite">{fileName}</span>
          </div>

          {/* Erreurs de parsing */}
          {parseErrors.length > 0 && (
            <div className="bg-danger-50 border border-danger-100 rounded-2xl p-4 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-danger-700 flex items-center gap-1">
                <AlertCircle size={13} /> {parseErrors.length} erreur{parseErrors.length > 1 ? 's' : ''} détectée{parseErrors.length > 1 ? 's' : ''}
              </p>
              {parseErrors.map((e, i) => (
                <p key={i} className="text-xs text-danger-700">
                  {e.row > 0 ? `Ligne ${e.row} : ` : ''}{e.message}
                </p>
              ))}
            </div>
          )}

          {/* Résumé */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-ok-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-ok-700">{rows.length}</p>
              <p className="text-xs text-ok-700 mt-0.5">Lignes valides</p>
            </div>
            <div className="bg-danger-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-danger-700">{parseErrors.length}</p>
              <p className="text-xs text-danger-700 mt-0.5">Lignes ignorées</p>
            </div>
          </div>

          {/* Aperçu table (5 premières lignes) */}
          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-softer">
              <table className="w-full text-xs">
                <thead className="bg-canvas-a">
                  <tr>
                    {columns.slice(0, 6).map(c => (
                      <th key={c.key} className="px-3 py-2 text-left font-extrabold text-slate whitespace-nowrap">
                        {c.header}
                      </th>
                    ))}
                    {columns.length > 6 && <th className="px-3 py-2 text-slate-light">…</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-canvas-a/60'}>
                      {columns.slice(0, 6).map(c => (
                        <td key={c.key} className="px-3 py-1.5 text-graphite truncate max-w-[160px] font-medium">
                          {String(row[c.key] ?? '—')}
                        </td>
                      ))}
                      {columns.length > 6 && <td className="px-3 py-1.5 text-slate-light">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && (
                <p className="text-xs text-slate text-center py-2 font-medium">
                  … et {rows.length - 5} autre{rows.length - 5 > 1 ? 's' : ''} ligne{rows.length - 5 > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ÉTAPE 3 : Résultat */}
      {step === 'result' && result && (
        <div className="space-y-4 py-2">
          <div className={`flex flex-col items-center gap-3 p-6 rounded-2xl ${
            result.errors.length === 0 ? 'bg-ok-50' : 'bg-amber-50'
          }`}>
            {result.errors.length === 0
              ? <CheckCircle size={40} className="text-ok-500" />
              : <AlertCircle size={40} className="text-amber-500" />}
            <p className="text-lg font-extrabold text-graphite">
              {result.inserted} ligne{result.inserted > 1 ? 's' : ''} importée{result.inserted > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-slate font-medium">
              sur {result.total} traitée{result.total > 1 ? 's' : ''}
              {result.errors.length > 0 && ` · ${result.errors.length} erreur${result.errors.length > 1 ? 's' : ''}`}
            </p>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-danger-50 border border-danger-100 rounded-2xl p-4 space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-danger-700 mb-2">Détail des erreurs :</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-danger-700">
                  {e.row > 0 ? `Ligne ${e.row} : ` : ''}{e.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
