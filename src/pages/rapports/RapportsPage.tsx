import { useState } from 'react'
import {
  BarChart3, Package, Monitor, FileText, Smartphone,
  Download, Wifi, Ticket, Zap, FileDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToCSV, exportToPDF, formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

// ---- Types de rapports disponibles ----
interface ReportDef {
  id: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  category: string
  filters?: FilterOption[]
}

interface FilterOption {
  key: string
  label: string
  options: { value: string; label: string }[]
}

const REPORTS: ReportDef[] = [
  // Parc
  { id: 'inv_actifs',     label: 'PC en service',             description: 'Liste des matériels actifs en service',          icon: Package,    color: 'text-green-600 bg-green-50',  category: 'Parc informatique' },
  { id: 'inv_pannes',     label: 'PC en panne',               description: 'Matériels avec état "En panne"',                 icon: Package,    color: 'text-red-600 bg-red-50',      category: 'Parc informatique' },
  { id: 'inv_renouveles', label: 'PC renouvelés',             description: 'Matériels avec état "Renouvelé"',                icon: Package,    color: 'text-blue-600 bg-blue-50',    category: 'Parc informatique' },
  { id: 'inv_desactives', label: 'Matériels désactivés',      description: 'Historique des matériels retirés du parc',       icon: Package,    color: 'text-gray-600 bg-gray-50',    category: 'Parc informatique' },
  { id: 'inv_complet',    label: 'Inventaire complet',        description: 'Tous les matériels actifs, tous types confondus', icon: Package,    color: 'text-primary-600 bg-primary-50', category: 'Parc informatique' },
  // Migrations
  { id: 'os_migres',      label: 'Migrations OS',             description: 'État de migration des systèmes d\'exploitation',  icon: Monitor,    color: 'text-indigo-600 bg-indigo-50', category: 'Migration' },
  { id: 'office_migres',  label: 'Migrations Office',         description: 'État de migration Microsoft Office',             icon: FileText,   color: 'text-blue-600 bg-blue-50',   category: 'Migration' },
  { id: 'os_non_migres',  label: 'OS non migrés',             description: 'Matériels avec OS non migré',                    icon: Monitor,    color: 'text-red-600 bg-red-50',     category: 'Migration' },
  { id: 'off_non_migres', label: 'Office non migrés',         description: 'Matériels avec Office non migré',                icon: FileText,   color: 'text-red-600 bg-red-50',     category: 'Migration' },
  // Mobilité
  { id: 'tsp_actifs',     label: 'TSP actifs',                description: 'Liste de tous les TSP actifs',                   icon: Smartphone, color: 'text-teal-600 bg-teal-50',   category: 'Mobilité' },
  { id: 'apk_deploiement',label: 'Déploiement APK',           description: 'État de déploiement APK par TSP',               icon: Download,   color: 'text-orange-600 bg-orange-50', category: 'Mobilité' },
  // Réseau
  { id: 'dualsim',        label: 'Sites Dual-SIM',            description: 'Liste des sites avec routeurs Dual-SIM',         icon: Wifi,       color: 'text-cyan-600 bg-cyan-50',   category: 'Réseau' },
  // Support
  { id: 'di_ouvertes',    label: 'DI ouvertes',               description: 'Demandes d\'intervention non clôturées',         icon: Ticket,     color: 'text-yellow-600 bg-yellow-50', category: 'Support' },
  { id: 'ds_ouvertes',    label: 'DS ouvertes',               description: 'Demandes de service non clôturées',             icon: Ticket,     color: 'text-purple-600 bg-purple-50', category: 'Support' },
  { id: 'dids_critiques', label: 'Demandes critiques',        description: 'DI/DS avec priorité critique en cours',          icon: Ticket,     color: 'text-red-600 bg-red-50',     category: 'Support' },
  // Électrique
  { id: 'onduleurs',      label: 'Onduleurs',                 description: 'État du parc onduleurs',                         icon: Zap,        color: 'text-amber-600 bg-amber-50',  category: 'Équipements électriques' },
  { id: 'regulateurs',    label: 'Régulateurs / Stabilisateurs', description: 'État des régulateurs et stabilisateurs',    icon: Zap,        color: 'text-amber-600 bg-amber-50',  category: 'Équipements électriques' },
]

// ---- Chargement des données selon le rapport ----
async function fetchReport(id: string): Promise<{ columns: string[]; rows: Record<string, string>[] }> {
  switch (id) {
    case 'inv_actifs': {
      const { data } = await supabase.from('inventaire').select('*').eq('actif', true).in('etat', ['En service']).order('numero_inventaire')
      return { columns: ['N° Inventaire', 'Type', 'Marque/Modèle', 'Utilisateur', 'Matricule', 'Société', 'Exploitation', 'Localisation', 'État'], rows: (data ?? []).map(r => ({ 'N° Inventaire': r.numero_inventaire ?? '', 'Type': r.type_materiel, 'Marque/Modèle': r.marque_modele ?? '', 'Utilisateur': r.utilisateur ?? '', 'Matricule': r.matricule ?? '', 'Société': r.societe ?? '', 'Exploitation': r.exploitation ?? '', 'Localisation': r.localisation ?? '', 'État': r.etat })) }
    }
    case 'inv_pannes': {
      const { data } = await supabase.from('inventaire').select('*').eq('actif', true).eq('etat', 'En panne').order('numero_inventaire')
      return { columns: ['N° Inventaire', 'Type', 'Marque/Modèle', 'Utilisateur', 'Société', 'Exploitation', 'Observations'], rows: (data ?? []).map(r => ({ 'N° Inventaire': r.numero_inventaire ?? '', 'Type': r.type_materiel, 'Marque/Modèle': r.marque_modele ?? '', 'Utilisateur': r.utilisateur ?? '', 'Société': r.societe ?? '', 'Exploitation': r.exploitation ?? '', 'Observations': r.observations ?? '' })) }
    }
    case 'inv_renouveles': {
      const { data } = await supabase.from('inventaire').select('*').eq('actif', true).eq('etat', 'Renouvelé').order('numero_inventaire')
      return { columns: ['N° Inventaire', 'Type', 'Marque/Modèle', 'Utilisateur', 'Société', 'Exploitation'], rows: (data ?? []).map(r => ({ 'N° Inventaire': r.numero_inventaire ?? '', 'Type': r.type_materiel, 'Marque/Modèle': r.marque_modele ?? '', 'Utilisateur': r.utilisateur ?? '', 'Société': r.societe ?? '', 'Exploitation': r.exploitation ?? '' })) }
    }
    case 'inv_desactives': {
      const { data } = await supabase.from('inventaire').select('*').eq('actif', false).order('date_desactivation', { ascending: false })
      return { columns: ['N° Inventaire', 'Type', 'Marque/Modèle', 'Utilisateur', 'Motif désactivation', 'Date désactivation'], rows: (data ?? []).map(r => ({ 'N° Inventaire': r.numero_inventaire ?? '', 'Type': r.type_materiel, 'Marque/Modèle': r.marque_modele ?? '', 'Utilisateur': r.utilisateur ?? '', 'Motif désactivation': r.motif_desactivation ?? '', 'Date désactivation': formatDate(r.date_desactivation) })) }
    }
    case 'inv_complet': {
      const { data } = await supabase.from('inventaire').select('*').eq('actif', true).order('type_materiel').order('numero_inventaire')
      return { columns: ['N° Inventaire', 'Type', 'N° Série', 'Marque/Modèle', 'Utilisateur', 'Matricule', 'Société', 'Exploitation', 'Localisation', 'État', 'Créé le'], rows: (data ?? []).map(r => ({ 'N° Inventaire': r.numero_inventaire ?? '', 'Type': r.type_materiel, 'N° Série': r.numero_serie ?? '', 'Marque/Modèle': r.marque_modele ?? '', 'Utilisateur': r.utilisateur ?? '', 'Matricule': r.matricule ?? '', 'Société': r.societe ?? '', 'Exploitation': r.exploitation ?? '', 'Localisation': r.localisation ?? '', 'État': r.etat, 'Créé le': formatDate(r.created_at) })) }
    }
    case 'os_migres': {
      const { data } = await supabase.from('systeme_exploitation').select('*, inventaire:inventaire(numero_inventaire,marque_modele,utilisateur,societe,exploitation)').order('date_modification', { ascending: false })
      return { columns: ['N° Inventaire', 'Modèle', 'Utilisateur', 'Société', 'Exploitation', 'Statut OS', 'Mis à jour'], rows: (data ?? []).map((r: Record<string, unknown>) => { const inv = r.inventaire as Record<string, string> | null; return { 'N° Inventaire': inv?.numero_inventaire ?? '', 'Modèle': inv?.marque_modele ?? '', 'Utilisateur': inv?.utilisateur ?? '', 'Société': inv?.societe ?? '', 'Exploitation': inv?.exploitation ?? '', 'Statut OS': String(r.statut_systeme ?? ''), 'Mis à jour': formatDate(String(r.date_modification ?? '')) } }) }
    }
    case 'office_migres': {
      const { data } = await supabase.from('microsoft_office').select('*, inventaire:inventaire(numero_inventaire,marque_modele,utilisateur,societe,exploitation)').order('date_modification', { ascending: false })
      return { columns: ['N° Inventaire', 'Modèle', 'Utilisateur', 'Société', 'Exploitation', 'Statut Office', 'Mis à jour'], rows: (data ?? []).map((r: Record<string, unknown>) => { const inv = r.inventaire as Record<string, string> | null; return { 'N° Inventaire': inv?.numero_inventaire ?? '', 'Modèle': inv?.marque_modele ?? '', 'Utilisateur': inv?.utilisateur ?? '', 'Société': inv?.societe ?? '', 'Exploitation': inv?.exploitation ?? '', 'Statut Office': String(r.statut_office ?? ''), 'Mis à jour': formatDate(String(r.date_modification ?? '')) } }) }
    }
    case 'os_non_migres': {
      const { data } = await supabase.from('systeme_exploitation').select('*, inventaire:inventaire(numero_inventaire,marque_modele,utilisateur,societe,exploitation)').eq('statut_systeme', 'Non migré')
      return { columns: ['N° Inventaire', 'Modèle', 'Utilisateur', 'Société', 'Exploitation'], rows: (data ?? []).map((r: Record<string, unknown>) => { const inv = r.inventaire as Record<string, string> | null; return { 'N° Inventaire': inv?.numero_inventaire ?? '', 'Modèle': inv?.marque_modele ?? '', 'Utilisateur': inv?.utilisateur ?? '', 'Société': inv?.societe ?? '', 'Exploitation': inv?.exploitation ?? '' } }) }
    }
    case 'off_non_migres': {
      const { data } = await supabase.from('microsoft_office').select('*, inventaire:inventaire(numero_inventaire,marque_modele,utilisateur,societe,exploitation)').eq('statut_office', 'Non migré')
      return { columns: ['N° Inventaire', 'Modèle', 'Utilisateur', 'Société', 'Exploitation'], rows: (data ?? []).map((r: Record<string, unknown>) => { const inv = r.inventaire as Record<string, string> | null; return { 'N° Inventaire': inv?.numero_inventaire ?? '', 'Modèle': inv?.marque_modele ?? '', 'Utilisateur': inv?.utilisateur ?? '', 'Société': inv?.societe ?? '', 'Exploitation': inv?.exploitation ?? '' } }) }
    }
    case 'tsp_actifs': {
      const { data } = await supabase.from('tsp').select('*, inventaire:inventaire(numero_inventaire,numero_serie,marque_modele)').eq('actif', true).order('nom_prenoms')
      return { columns: ['Nom & Prénoms', 'Matricule', 'Société', 'Exploitation', 'N° Inv. Appareil', 'N° Série', 'Modèle', 'N° Puce', 'Opérateur'], rows: (data ?? []).map((r: Record<string, unknown>) => { const inv = r.inventaire as Record<string, string> | null; return { 'Nom & Prénoms': String(r.nom_prenoms ?? ''), 'Matricule': String(r.matricule ?? ''), 'Société': String(r.societe_entite ?? ''), 'Exploitation': String(r.exploitation ?? ''), 'N° Inv. Appareil': inv?.numero_inventaire ?? '', 'N° Série': inv?.numero_serie ?? '', 'Modèle': inv?.marque_modele ?? '', 'N° Puce': String(r.numero_puce ?? ''), 'Opérateur': String(r.operateur ?? '') } }) }
    }
    case 'apk_deploiement': {
      const { data } = await supabase.from('deploiement_apk').select('*, tsp:tsp(nom_prenoms,matricule,societe_entite,exploitation,operateur)').order('statut_deploiement')
      return { columns: ['TSP', 'Matricule', 'Société', 'Exploitation', 'Opérateur', 'Statut APK', 'Date déploiement'], rows: (data ?? []).map((r: Record<string, unknown>) => { const tsp = r.tsp as Record<string, string> | null; return { 'TSP': tsp?.nom_prenoms ?? '', 'Matricule': tsp?.matricule ?? '', 'Société': tsp?.societe_entite ?? '', 'Exploitation': tsp?.exploitation ?? '', 'Opérateur': tsp?.operateur ?? '', 'Statut APK': String(r.statut_deploiement ?? ''), 'Date déploiement': formatDate(String(r.date_deploiement ?? '')) } }) }
    }
    case 'dualsim': {
      const { data } = await supabase.from('site_dualsim').select('*, inventaire:inventaire(numero_inventaire,marque_modele)').eq('actif', true).order('site')
      return { columns: ['Site', 'Utilisateur', 'Société', 'Adresse routeur', 'N° Inv. routeur', 'SIM 1', 'Opérateur 1', 'SIM 2', 'Opérateur 2'], rows: (data ?? []).map((r: Record<string, unknown>) => { const inv = r.inventaire as Record<string, string> | null; return { 'Site': String(r.site ?? ''), 'Utilisateur': String(r.utilisateur ?? ''), 'Société': String(r.societe ?? ''), 'Adresse routeur': String(r.adresse_routeur ?? ''), 'N° Inv. routeur': inv?.numero_inventaire ?? '', 'SIM 1': String(r.numero_sim1 ?? ''), 'Opérateur 1': String(r.operateur_sim1 ?? ''), 'SIM 2': String(r.numero_sim2 ?? ''), 'Opérateur 2': String(r.operateur_sim2 ?? '') } }) }
    }
    case 'di_ouvertes': {
      const { data } = await supabase.from('suivi_di_ds').select('*').eq('type_demande', 'DI').not('statut', 'in', '("Clôturé","Annulé","Résolu")').order('priorite').order('created_at')
      return { columns: ['N°', 'Date', 'Demandeur', 'Société', 'Exploitation', 'Objet', 'Priorité', 'Statut', 'Technicien'], rows: (data ?? []).map(r => ({ 'N°': r.numero_demande ?? '', 'Date': formatDate(r.date_demande), 'Demandeur': r.demandeur ?? '', 'Société': r.societe ?? '', 'Exploitation': r.exploitation ?? '', 'Objet': r.objet, 'Priorité': r.priorite, 'Statut': r.statut, 'Technicien': r.technicien ?? '' })) }
    }
    case 'ds_ouvertes': {
      const { data } = await supabase.from('suivi_di_ds').select('*').eq('type_demande', 'DS').not('statut', 'in', '("Clôturé","Annulé","Résolu")').order('priorite').order('created_at')
      return { columns: ['N°', 'Date', 'Demandeur', 'Société', 'Objet', 'Priorité', 'Statut', 'Technicien'], rows: (data ?? []).map(r => ({ 'N°': r.numero_demande ?? '', 'Date': formatDate(r.date_demande), 'Demandeur': r.demandeur ?? '', 'Société': r.societe ?? '', 'Objet': r.objet, 'Priorité': r.priorite, 'Statut': r.statut, 'Technicien': r.technicien ?? '' })) }
    }
    case 'dids_critiques': {
      const { data } = await supabase.from('suivi_di_ds').select('*').eq('priorite', 'Critique').not('statut', 'in', '("Clôturé","Annulé","Résolu")').order('created_at')
      return { columns: ['Type', 'N°', 'Date', 'Demandeur', 'Objet', 'Statut', 'Technicien'], rows: (data ?? []).map(r => ({ 'Type': r.type_demande, 'N°': r.numero_demande ?? '', 'Date': formatDate(r.date_demande), 'Demandeur': r.demandeur ?? '', 'Objet': r.objet, 'Statut': r.statut, 'Technicien': r.technicien ?? '' })) }
    }
    case 'onduleurs': {
      const { data } = await supabase.from('inventaire').select('*').eq('type_materiel', 'Onduleur').eq('actif', true).order('etat').order('localisation')
      return { columns: ['N° Inventaire', 'N° Série', 'Marque/Modèle', 'Utilisateur', 'Société', 'Localisation', 'Exploitation', 'État'], rows: (data ?? []).map(r => ({ 'N° Inventaire': r.numero_inventaire ?? '', 'N° Série': r.numero_serie ?? '', 'Marque/Modèle': r.marque_modele ?? '', 'Utilisateur': r.utilisateur ?? '', 'Société': r.societe ?? '', 'Localisation': r.localisation ?? '', 'Exploitation': r.exploitation ?? '', 'État': r.etat })) }
    }
    case 'regulateurs': {
      const { data } = await supabase.from('inventaire').select('*').eq('type_materiel', 'Régulateur / Stabilisateur').eq('actif', true).order('etat')
      return { columns: ['N° Inventaire', 'N° Série', 'Marque/Modèle', 'Utilisateur', 'Localisation', 'Exploitation', 'État'], rows: (data ?? []).map(r => ({ 'N° Inventaire': r.numero_inventaire ?? '', 'N° Série': r.numero_serie ?? '', 'Marque/Modèle': r.marque_modele ?? '', 'Utilisateur': r.utilisateur ?? '', 'Localisation': r.localisation ?? '', 'Exploitation': r.exploitation ?? '', 'État': r.etat })) }
    }
    default:
      return { columns: [], rows: [] }
  }
}

// ---- Grouper par catégorie ----
const CATEGORIES = [...new Set(REPORTS.map(r => r.category))]

export function RapportsPage() {
  const [generating, setGenerating] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<{ report: ReportDef; columns: string[]; rows: Record<string, string>[] } | null>(null)

  async function handleGenerate(report: ReportDef, format: 'xlsx' | 'csv' | 'pdf' | 'preview') {
    setGenerating(report.id + '-' + format)
    try {
      const { columns, rows } = await fetchReport(report.id)
      if (!rows.length) { toast.error('Aucune donnée pour ce rapport'); return }
      const fname = `${report.id}_${new Date().toISOString().slice(0, 10)}`
      if (format === 'preview') {
        setPreviewData({ report, columns, rows })
      } else if (format === 'xlsx') {
        exportToExcel(rows, fname)
        toast.success(`${rows.length} lignes exportées en Excel`)
      } else if (format === 'csv') {
        exportToCSV(rows, fname)
        toast.success(`${rows.length} lignes exportées en CSV`)
      } else {
        exportToPDF(columns, rows.map(r => columns.map(c => r[c] ?? '')), fname, report.label)
        toast.success(`PDF généré`)
      }
    } catch {
      toast.error('Erreur lors de la génération')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 size={22} className="text-primary-700" /> États & Rapports
          </h1>
          <p className="page-subtitle">Générez et exportez des états depuis la base de données en temps réel</p>
        </div>
      </div>

      {CATEGORIES.map(cat => (
        <section key={cat}>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{cat}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {REPORTS.filter(r => r.category === cat).map(report => {
              const Icon = report.icon
              const isLoading = generating?.startsWith(report.id)
              return (
                <div key={report.id} className="card p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${report.color}`}>
                      <Icon size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{report.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{report.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      disabled={!!isLoading}
                      onClick={() => handleGenerate(report, 'preview')}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                    >
                      {isLoading && generating === report.id + '-preview'
                        ? <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        : null}
                      Aperçu
                    </button>
                    {(['xlsx', 'csv', 'pdf'] as const).map(fmt => (
                      <button
                        key={fmt}
                        disabled={!!isLoading}
                        onClick={() => handleGenerate(report, fmt)}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                      >
                        {isLoading && generating === report.id + '-' + fmt
                          ? <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          : <FileDown size={11} />}
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* Modal aperçu */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewData(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{previewData.report.label}</h3>
                <p className="text-xs text-gray-500">{previewData.rows.length} enregistrement{previewData.rows.length > 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-2">
                {(['xlsx', 'csv', 'pdf'] as const).map(fmt => (
                  <button key={fmt} onClick={() => handleGenerate(previewData.report, fmt)} className="btn-primary text-xs py-1.5 px-3 gap-1">
                    <FileDown size={12} />{fmt.toUpperCase()}
                  </button>
                ))}
                <button onClick={() => setPreviewData(null)} className="btn-secondary text-xs py-1.5 px-3">Fermer</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 scrollbar-thin">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary-50">
                    {previewData.columns.map(col => (
                      <th key={col} className="px-3 py-2 text-left font-semibold text-primary-800 border border-primary-100 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.slice(0, 100).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {previewData.columns.map(col => (
                        <td key={col} className="px-3 py-1.5 border border-gray-100 text-gray-700 max-w-xs truncate">
                          {row[col] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.rows.length > 100 && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Aperçu limité à 100 lignes. Exportez pour voir toutes les données.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
