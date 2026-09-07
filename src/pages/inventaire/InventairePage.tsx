import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Eye, Pencil, PowerOff, Download, Filter, Archive, Upload } from 'lucide-react'
import { supabase, logAudit } from '@/lib/supabase'
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
  'Hors service','Réformé','Déposé au Siège',
]

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'type_materiel',     header: 'Type de matériel',  aliases: ['Type', 'Matériel', 'Type matériel'], required: true,
    validate: v => TYPES_VALIDES.includes(v) ? null : `Type invalide : "${v}"` },
  { key: 'numero_inventaire', header: 'N° Inventaire',     aliases: ['N° inv', 'Numéro inventaire', 'Code inventaire'], required: false },
  { key: 'numero_serie',      header: 'N° Série',          aliases: ['Serial number', 'Numéro série', 'SN'], required: false },
  { key: 'marque_modele',     header: 'Marque / Modèle',   aliases: ['Marque', 'Modèle', 'Modele'], required: false },
  { key: 'utilisateur',       header: 'Utilisateur',       aliases: ['Affectataire', 'Nom utilisateur', 'User'], required: false },
  { key: 'matricule',         header: 'Matricule',         aliases: ['Matricule utilisateur'], required: false },
  { key: 'societe',           header: 'Société',           aliases: ['Societe', 'Entité', 'Entite'], required: false },
  { key: 'exploitation',      header: 'Exploitation',      aliases: ['Site exploitation'], required: false },
  { key: 'localisation',      header: 'Localisation',      aliases: ['Emplacement', 'Site', 'Lieu'], required: false },
  { key: 'etat',              header: 'État',              required: false,
    validate: v => !v || ETATS_VALIDES.includes(v) ? null : `État invalide : "${v}"`,
    transform: v => v || 'En service' },
  { key: 'observations',      header: 'Observations',      aliases: ['Observation', 'Commentaire', 'Commentaires'], required: false },
]

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

const ETAT_OPTIONS = ['', 'En service', 'En panne', 'Renouvelé', 'En réparation', 'En stock', 'Hors service', 'Réformé', 'Déposé au Siège']

export function InventairePage() {
  const navigate = useNavigate()
  const { isAssistant } = useAuth()
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
    let inserted = 0
    let updated = 0
    const errors: { row: number; message: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        // Les fichiers de production peuvent contenir une version plus récente d'un matériel :
        // le numéro d'inventaire sert alors de clé de mise à jour.
        if (row.numero_inventaire) {
          const { data: dup } = await supabase
            .from('inventaire')
            .select('id_materiel')
            .eq('numero_inventaire', row.numero_inventaire)
            .maybeSingle()
          if (dup) {
            const { error } = await supabase
              .from('inventaire')
              .update({ ...row, actif: true })
              .eq('id_materiel', dup.id_materiel)
            if (error) throw error
            await logAudit({ action: 'IMPORT_MAJ', table_concernee: 'inventaire', id_enregistrement: dup.id_materiel, nouvelles_valeurs: row })
            updated++
            continue
          }
        }
        const { data: created, error } = await supabase
          .from('inventaire')
          .insert({ ...row, actif: true })
          .select('id_materiel')
          .single()
        if (error) throw error
        await logAudit({
          action: 'IMPORT',
          table_concernee: 'inventaire',
          id_enregistrement: created.id_materiel,
          nouvelles_valeurs: row,
        })
        inserted++
      } catch (e: unknown) {
        errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Erreur inconnue' })
      }
    }

    if (inserted > 0) {
      toast.success(`${inserted} matériel${inserted > 1 ? 's' : ''} importé${inserted > 1 ? 's' : ''}`)
      load()
    }
    if (updated > 0) {
      toast.success(`${updated} matériel${updated > 1 ? 's' : ''} mis à jour`)
      load()
    }
    return { total: rows.length, inserted, updated, errors }
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
              className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
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
            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl border border-gray-200
                            shadow-lg py-1 z-10 hidden group-hover:block">
              {(['xlsx','csv','pdf'] as const).map(f => (
                <button key={f} onClick={() => handleExport(f)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
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
                className="text-sm text-red-600 hover:underline">
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
        columns={IMPORT_COLUMNS}
        templateName="inventaire"
        templateExample={IMPORT_EXAMPLE}
        onImport={handleImport}
      />
    </div>
  )
}
