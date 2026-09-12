import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Eye, Pencil, PowerOff, Download, Filter, Archive, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchExistingSet, batchInsert, batchLogAudit } from '@/lib/importHelpers'
import { useAuth } from '@/context/AuthContext'
import type { Inventaire } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { DesactiverModal } from './DesactiverModal'
import { ImportExcel, type ImportColumn, type ImportResult } from '@/components/ui/ImportExcel'
import { exportToExcel, exportToCSV, exportToPDF, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const TYPES_VALIDES = [
  'Ordinateur de bureau','Ordinateur portable','Imprimante simple','Imprimante MFP',
  'Scanner','Routeur','Switch','Téléphone','Tablette','TSP','Onduleur',
  'Régulateur / Stabilisateur','Borne Wi-Fi','Autre',
]
const ETATS_VALIDES = [
  'En service','En panne','Renouvelé','En réparation','En stock',
  'Hors service','Réformé','Déposé au Siège','Volé',
]

// Correspondances pour les libellés qui varient d'un fichier Excel à l'autre
// (typos, casse, formulations proches) mais désignent le même type de matériel.
// Clé = valeur normalisée (minuscules, sans accents) telle qu'elle peut apparaître
// dans un fichier source ; valeur = libellé officiel du référentiel.
const TYPE_ALIASES: Record<string, string> = {
  'imprimante laser simple': 'Imprimante simple',
  'stabilisateur': 'Régulateur / Stabilisateur',
  'switch': 'Switch',
  'terminal de saisie portable': 'TSP',
  'controleur domaine': 'Contrôleur de domaine',
  'controleur de domaine': 'Contrôleur de domaine',
}

// Résout un état saisi dans l'Excel vers le libellé officiel (insensible
// à la casse et aux accents : "en panne" / "EN PANNE" → "En panne").
function normalizeLabel(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function resolveEtat(raw: string): string | null {
  const norm = normalizeLabel(raw)
  return ETATS_VALIDES.find(e => normalizeLabel(e) === norm) ?? null
}

// Résout un libellé de type saisi dans l'Excel vers le libellé officiel du
// référentiel `ref_types_materiel` (comparaison insensible à la casse et aux accents,
// puis via la table d'alias ci-dessus). Retourne null si aucune correspondance.
function resolveType(raw: string, validTypes: string[]): string | null {
  const norm = normalizeLabel(raw)
  const exact = validTypes.find(t => normalizeLabel(t) === norm)
  if (exact) return exact
  const aliasKey = Object.keys(TYPE_ALIASES).find(k => normalizeLabel(k) === norm)
  if (aliasKey && validTypes.includes(TYPE_ALIASES[aliasKey])) return TYPE_ALIASES[aliasKey]
  return null
}

function buildImportColumns(validTypes: string[]): ImportColumn[] {
  // Tant que le référentiel n'est pas chargé, on retombe sur la liste par défaut
  // pour ne pas rejeter toutes les lignes le temps du premier rendu.
  const types = validTypes.length > 0 ? validTypes : TYPES_VALIDES
  return [
    { key: 'type_materiel',     header: 'Type de matériel',  required: true,
      validate: v => resolveType(v, types) ? null : `Type invalide : "${v}" (non reconnu dans le référentiel Types de matériel)`,
      transform: v => resolveType(v, types) ?? v },
    { key: 'numero_inventaire', header: 'N° Inventaire',     required: false },
    { key: 'numero_serie',      header: 'N° Série',          required: false },
    { key: 'marque_modele',     header: 'Marque / Modèle',   required: false },
    { key: 'utilisateur',       header: 'Utilisateur',       required: false },
    { key: 'matricule',         header: 'Matricule',         required: false },
    { key: 'societe',           header: 'Société',           required: false },
    { key: 'exploitation',      header: 'Exploitation',      required: false },
    { key: 'localisation',      header: 'Localisation',      required: false },
    { key: 'etat',              header: 'État',              required: false,
      validate: v => !v || resolveEtat(v) ? null : `État invalide : "${v}"`,
      transform: v => resolveEtat(v) ?? (v || 'En service') },
    { key: 'observations',      header: 'Observations',      required: false },
  ]
}

const IMPORT_EXAMPLE: Record<string, string> = {
  type_materiel:     'Ordinateur de bureau',
  numero_inventaire: 'INV-2024-001',
  numero_serie:      'SN123456789',
  marque_modele:     'Dell OptiPlex 7090',
  utilisateur:       'Jean Dupont',
  matricule:         'M12345',
  societe:           'Société A',
  exploitation:      'Exploitation Nord',
  localisation:      'Bâtiment A - Bureau 12',
  etat:              'En service',
  observations:      '',
}

const ETAT_OPTIONS = ['', 'En service', 'En panne', 'Renouvelé', 'En réparation', 'En stock', 'Hors service', 'Réformé', 'Déposé au Siège', 'Volé']

export function InventairePage() {
  const navigate = useNavigate()
  const { isAssistant, user } = useAuth()
  const [data, setData] = useState<Inventaire[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterEtat, setFilterEtat] = useState('')
  const [filterType, setFilterType] = useState('')
  const [sortKey, setSortKey] = useState('numero_inventaire')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [deactivateTarget, setDeactivateTarget] = useState<Inventaire | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [types, setTypes] = useState<string[]>([])
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    supabase.from('ref_types_materiel').select('valeur').eq('actif', true).order('ordre')
      .then(({ data }) => setTypes(data?.map(r => r.valeur) ?? []))
  }, [])

  const importColumns = useMemo(() => buildImportColumns(types), [types])

  const load = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let q = supabase
      .from('inventaire')
      .select('*', { count: 'exact' })
      .eq('actif', true)
      .order(sortKey, { ascending: sortDir === 'asc' })
      .range(from, to)

    if (search.trim()) {
      q = q.or(
        `numero_inventaire.ilike.%${search}%,numero_serie.ilike.%${search}%,utilisateur.ilike.%${search}%,matricule.ilike.%${search}%,marque_modele.ilike.%${search}%`
      )
    }
    if (filterEtat) q = q.eq('etat', filterEtat)
    if (filterType) q = q.eq('type_materiel', filterType)

    const { data, count, error } = await q
    if (!error) { setData(data ?? []); setTotal(count ?? 0) }
    setLoading(false)
  }, [page, pageSize, search, filterEtat, filterType, sortKey, sortDir])

  useEffect(() => { load() }, [load])

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  async function handleExport(format: 'xlsx' | 'csv' | 'pdf') {
    // Exporter avec les filtres actifs (sans pagination)
    let q = supabase.from('inventaire').select('*').eq('actif', true).order(sortKey, { ascending: sortDir === 'asc' })
    if (search.trim()) q = q.or(`numero_inventaire.ilike.%${search}%,numero_serie.ilike.%${search}%,utilisateur.ilike.%${search}%`)
    if (filterEtat) q = q.eq('etat', filterEtat)
    if (filterType) q = q.eq('type_materiel', filterType)
    const { data: all } = await q
    if (!all?.length) { toast.error('Aucune donnée à exporter'); return }
    const rows = all.map(r => ({
      'N° Inventaire': r.numero_inventaire ?? '',
      'Type': r.type_materiel,
      'Marque/Modèle': r.marque_modele ?? '',
      'N° Série': r.numero_serie ?? '',
      'Utilisateur': r.utilisateur ?? '',
      'Matricule': r.matricule ?? '',
      'Société': r.societe ?? '',
      'Exploitation': r.exploitation ?? '',
      'Localisation': r.localisation ?? '',
      'État': r.etat,
      'Créé le': formatDate(r.created_at),
    }))
    const fname = `inventaire_${new Date().toISOString().slice(0,10)}`
    if (format === 'xlsx') exportToExcel(rows, fname)
    else if (format === 'csv') exportToCSV(rows, fname)
    else exportToPDF(
      Object.keys(rows[0]),
      rows.map(r => Object.values(r)),
      fname, 'Inventaire du parc informatique'
    )
  }

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportResult> {
    const errors: { row: number; message: string }[] = []

    // 1) Détection des doublons EN MASSE (2 requêtes au lieu de 2*N) :
    //    contre la base existante, ET entre les lignes du fichier lui-même.
    const numInvValues = rows.map(r => r.numero_inventaire as string | undefined)
    const numSerieValues = rows.map(r => r.numero_serie as string | undefined)
    const [existingInv, existingSerie] = await Promise.all([
      fetchExistingSet('inventaire', 'numero_inventaire', numInvValues),
      fetchExistingSet('inventaire', 'numero_serie', numSerieValues),
    ])
    const seenInv = new Set<string>()
    const seenSerie = new Set<string>()

    const validRows: { origIndex: number; payload: Record<string, unknown> }[] = []

    rows.forEach((row, i) => {
      const numInv = row.numero_inventaire as string | undefined
      const numSerie = row.numero_serie as string | undefined
      if (numInv && existingInv.has(numInv)) {
        errors.push({ row: i + 2, message: `N° inventaire "${numInv}" déjà existant en base` }); return
      }
      if (numInv && seenInv.has(numInv)) {
        errors.push({ row: i + 2, message: `N° inventaire "${numInv}" en double dans le fichier` }); return
      }
      if (numSerie && existingSerie.has(numSerie)) {
        errors.push({ row: i + 2, message: `N° série "${numSerie}" déjà existant en base` }); return
      }
      if (numSerie && seenSerie.has(numSerie)) {
        errors.push({ row: i + 2, message: `N° série "${numSerie}" en double dans le fichier` }); return
      }
      if (numInv) seenInv.add(numInv)
      if (numSerie) seenSerie.add(numSerie)
      validRows.push({ origIndex: i, payload: { ...row, actif: true } })
    })

    // 2) Insertion EN LOTS (au lieu d'un insert par ligne), avec repli
    //    ligne par ligne uniquement si un lot entier échoue.
    const { created, errorsByIndex } = await batchInsert<{ id_materiel: string }>(
      'inventaire', validRows.map(v => v.payload), 'id_materiel'
    )
    errorsByIndex.forEach((message, i) => {
      errors.push({ row: validRows[i].origIndex + 2, message })
    })

    // 3) Journal d'audit en masse (best-effort, ne bloque jamais l'import).
    const auditEntries = validRows
      .map((v, i) => ({ v, row: created[i] }))
      .filter(({ row }) => row)
      .map(({ v, row }) => ({
        utilisateur: user?.id ?? null,
        action: 'IMPORT',
        table_concernee: 'inventaire',
        id_enregistrement: row!.id_materiel,
        nouvelles_valeurs: v.payload,
      }))
    await batchLogAudit(auditEntries)

    const inserted = created.filter(Boolean).length
    if (inserted > 0) {
      toast.success(`${inserted} matériel${inserted > 1 ? 's' : ''} importé${inserted > 1 ? 's' : ''}`)
      load()
    }
    return { total: rows.length, inserted, errors }
  }

  const columns: Column<Inventaire>[] = [
    { key: 'numero_inventaire', header: 'N° Inventaire', sortable: true,
      render: r => <span className="font-mono text-xs font-semibold text-primary-700">{r.numero_inventaire ?? '—'}</span> },
    { key: 'type_materiel',     header: 'Type',          sortable: true,
      render: r => <span className="text-xs">{r.type_materiel}</span> },
    { key: 'marque_modele',     header: 'Marque / Modèle', sortable: true },
    { key: 'utilisateur',       header: 'Utilisateur',   sortable: true },
    { key: 'societe',           header: 'Société',       sortable: true },
    { key: 'exploitation',      header: 'Exploitation',  sortable: true },
    { key: 'etat',              header: 'État',          sortable: true,
      render: r => <Badge value={r.etat} /> },
    { key: 'actions',           header: '',
      className: 'w-32 text-right',
      render: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => navigate(`/inventaire/${r.id_materiel}`)} className="btn-icon" title="Voir">
            <Eye size={15} />
          </button>
          {isAssistant && (
            <button onClick={() => navigate(`/inventaire/${r.id_materiel}/modifier`)} className="btn-icon" title="Modifier">
              <Pencil size={15} />
            </button>
          )}
          {isAssistant && (
            <button
              onClick={() => setDeactivateTarget(r)}
              className="btn-icon text-danger-500 hover:text-danger-700 hover:bg-danger-50"
              title="Désactiver"
            >
              <PowerOff size={15} />
            </button>
          )}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaire</h1>
          <p className="page-subtitle">{total} matériel{total > 1 ? 's' : ''} actif{total > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/inventaire/archives" className="btn-secondary gap-2 text-sm">
            <Archive size={15} /> Archives
          </Link>
          {/* Export */}
          <div className="relative group">
            <button className="btn-secondary gap-2 text-sm">
              <Download size={15} /> Exporter
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-2xl
                            shadow-soft py-1.5 z-10 hidden group-hover:block">
              {(['xlsx','csv','pdf'] as const).map(f => (
                <button key={f} onClick={() => handleExport(f)}
                  className="w-full text-left px-3.5 py-2 text-sm text-graphite font-medium hover:bg-canvas-a">
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {isAssistant && (
            <>
              <button onClick={() => setImportOpen(true)} className="btn-secondary gap-2 text-sm">
                <Upload size={15} /> Importer
              </button>
              <Link to="/inventaire/nouveau" className="btn-primary gap-2 text-sm">
                <Plus size={15} /> Nouveau matériel
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            placeholder="N° inventaire, série, utilisateur…"
            className="flex-1"
          />
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`btn-secondary text-sm gap-1.5 ${showFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : ''}`}
          >
            <Filter size={14} /> Filtres
            {(filterEtat || filterType) && (
              <span className="w-4 h-4 bg-primary-600 text-white rounded-full text-[10px] flex items-center justify-center">
                {[filterEtat, filterType].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
            <select value={filterEtat} onChange={e => { setFilterEtat(e.target.value); setPage(1) }}
              className="input text-sm w-44">
              <option value="">Tous les états</option>
              {ETAT_OPTIONS.filter(Boolean).map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
              className="input text-sm w-52">
              <option value="">Tous les types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(filterEtat || filterType) && (
              <button onClick={() => { setFilterEtat(''); setFilterType(''); setPage(1) }}
                className="text-sm text-danger-700 hover:underline">
                Effacer les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="card">
        <Table
          columns={columns}
          data={data}
          loading={loading}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          rowKey={r => r.id_materiel}
          emptyMessage="Aucun matériel trouvé."
        />
        <Pagination
          page={page} pageSize={pageSize} total={total}
          onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }}
        />
      </div>

      {/* Modal désactivation */}
      <DesactiverModal
        materiel={deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onSuccess={() => { setDeactivateTarget(null); load() }}
      />

      {/* Modal import */}
      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer l'inventaire depuis Excel"
        columns={importColumns}
        templateName="inventaire"
        templateExample={IMPORT_EXAMPLE}
        onImport={handleImport}
      />
    </div>
  )
}
