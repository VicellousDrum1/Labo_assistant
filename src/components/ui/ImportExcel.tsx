import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, Info } from 'lucide-react'
import { Modal } from './Modal'

// ---- Types ----
export interface ImportColumn {
  key: string          // clé dans l'objet de sortie
  header: string       // nom exact dans l'Excel (modèle)
  /** Intitulés reconnus dans les fichiers historiques, en plus du modèle. */
  aliases?: string[]
  required?: boolean
  validate?: (v: string) => string | null  // retourne message d'erreur ou null
  transform?: (v: string) => unknown       // transformation avant insertion
}

export interface ImportResult {
  total: number
  inserted: number
  updated?: number
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

// Rend les en-têtes tolérants aux accents, espaces, ponctuation et casse.
const normaliseHeader = (value: unknown) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '')

const cellText = (value: unknown) => value instanceof Date && !Number.isNaN(value.getTime())
  ? value.toISOString().slice(0, 10)
  : String(value ?? '').trim()

export function ImportExcel({ open, onClose, title, columns, templateName, onImport, templateExample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [sheetName, setSheetName] = useState('')
  const [matchedColumns, setMatchedColumns] = useState<string[]>([])

  function reset() {
    setStep('upload')
    setFileName('')
    setRows([])
    setParseErrors([])
    setResult(null)
    setSheetName('')
    setMatchedColumns([])
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
          fill: { fgColor: { rgb: '1E40AF' } },
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
        const firstSheet = wb.SheetNames[0]
        const ws = wb.Sheets[firstSheet]
        setSheetName(firstSheet)
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]

        if (raw.length < 2) {
          setParseErrors([{ row: 0, message: 'Le fichier est vide ou ne contient pas de données.' }])
          setStep('preview')
          return
        }

        // Première ligne = en-têtes
        const fileHeaders = raw[0].map(h => String(h).trim())
        const normalisedHeaders = fileHeaders.map(normaliseHeader)
        const errors: { row: number; message: string }[] = []

        // Vérifier les colonnes requises
        const missingCols = columns
          .filter(c => c.required)
          .filter(c => ![c.header, c.key, ...(c.aliases ?? [])].some(name => normalisedHeaders.includes(normaliseHeader(name))))
          .map(c => c.header)
        if (missingCols.length) {
          setParseErrors([{ row: 0, message: `Colonnes manquantes : ${missingCols.join(', ')}` }])
          setStep('preview')
          return
        }

        // Mapper les index
        const colIndexes: Record<string, number> = {}
        columns.forEach(c => {
          const accepted = [c.header, c.key, ...(c.aliases ?? [])].map(normaliseHeader)
          const idx = normalisedHeaders.findIndex(header => accepted.includes(header))
          if (idx >= 0) colIndexes[c.key] = idx
        })
        setMatchedColumns(columns.filter(c => colIndexes[c.key] !== undefined).map(c => c.header))

        // Valider et transformer chaque ligne
        const validRows: Record<string, unknown>[] = []
        for (let i = 1; i < raw.length; i++) {
          const rawRow = raw[i]
          // Ignorer lignes vides
          if (rawRow.every(cell => cellText(cell) === '')) continue

          const rowErrors: string[] = []
          const obj: Record<string, unknown> = {}

          columns.forEach(c => {
            const idx = colIndexes[c.key]
            const raw_val = idx !== undefined ? cellText(rawRow[idx]) : ''

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
        setParseErrors([{ row: 0, message: 'Impossible de lire ce fichier. Vérifiez le format Excel (.xlsx, .xls) ou CSV.' }])
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
          <div className="flex items-center justify-between p-4 bg-primary-50 rounded-xl border border-primary-100">
            <div>
              <p className="text-sm font-medium text-primary-800">Modèle Excel</p>
            <p className="text-xs text-primary-600 mt-0.5">
                Un modèle est disponible, mais vos colonnes historiques sont aussi reconnues.
              </p>
            </div>
            <button onClick={downloadTemplate} className="btn-primary text-sm gap-2 flex-shrink-0">
              <Download size={14} /> Télécharger le modèle
            </button>
          </div>

          {/* Zone de dépôt */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center
                       hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <FileSpreadsheet size={32} className="text-primary-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">
              Glissez votre fichier ici ou <span className="text-primary-700 underline">parcourir</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Formats acceptés : .xlsx, .xls, .csv · première feuille utilisée</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
          </div>

          <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
            <Info size={15} className="mt-0.5 shrink-0" />
            <p>Les lignes sont contrôlées avant tout enregistrement. Les colonnes non reconnues sont ignorées : elles ne modifient aucune donnée.</p>
          </div>

          {/* Colonnes attendues */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Colonnes du modèle
            </p>
            <div className="flex flex-wrap gap-1.5">
              {columns.map(c => (
                <span key={c.key}
                  className={`text-xs px-2 py-0.5 rounded-full ${c.required
                    ? 'bg-primary-100 text-primary-800 font-medium'
                    : 'bg-gray-100 text-gray-600'}`}>
                  {c.header}{c.required ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">* Champs obligatoires</p>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 : Aperçu / Validation */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{fileName}</span>
            {sheetName && <span className="text-gray-400">· Feuille : {sheetName}</span>}
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-700">{matchedColumns.length} colonne{matchedColumns.length > 1 ? 's' : ''} reconnue{matchedColumns.length > 1 ? 's' : ''}</span>
            {matchedColumns.length > 0 && <span className="ml-1">: {matchedColumns.join(' · ')}</span>}
          </div>

          {/* Erreurs de parsing */}
          {parseErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                <AlertCircle size={13} /> {parseErrors.length} erreur{parseErrors.length > 1 ? 's' : ''} détectée{parseErrors.length > 1 ? 's' : ''}
              </p>
              {parseErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  {e.row > 0 ? `Ligne ${e.row} : ` : ''}{e.message}
                </p>
              ))}
            </div>
          )}

          {/* Résumé */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{rows.length}</p>
              <p className="text-xs text-green-600 mt-0.5">Lignes valides</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{parseErrors.length}</p>
              <p className="text-xs text-red-600 mt-0.5">Lignes ignorées</p>
            </div>
          </div>

          {/* Aperçu table (5 premières lignes) */}
          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.slice(0, 6).map(c => (
                      <th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                        {c.header}
                      </th>
                    ))}
                    {columns.length > 6 && <th className="px-3 py-2 text-gray-400">…</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {columns.slice(0, 6).map(c => (
                        <td key={c.key} className="px-3 py-1.5 text-gray-700 truncate max-w-[160px]">
                          {String(row[c.key] ?? '—')}
                        </td>
                      ))}
                      {columns.length > 6 && <td className="px-3 py-1.5 text-gray-300">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && (
                <p className="text-xs text-gray-400 text-center py-2">
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
            result.errors.length === 0 ? 'bg-green-50' : 'bg-orange-50'
          }`}>
            {result.errors.length === 0
              ? <CheckCircle size={40} className="text-green-500" />
              : <AlertCircle size={40} className="text-orange-500" />}
            <p className="text-lg font-bold text-gray-800">
              {result.inserted} ligne{result.inserted > 1 ? 's' : ''} importée{result.inserted > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-gray-500">
              sur {result.total} traitée{result.total > 1 ? 's' : ''}
              {result.updated ? ` · ${result.updated} mise${result.updated > 1 ? 's' : ''} à jour` : ''}
              {result.errors.length > 0 && ` · ${result.errors.length} erreur${result.errors.length > 1 ? 's' : ''}`}
            </p>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 mb-2">Détail des erreurs :</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
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
