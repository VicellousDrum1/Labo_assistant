import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, PowerOff, Clock, Monitor, FileText, BarChart3, Laptop } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Inventaire, Poste, SystemeExploitation, MicrosoftOffice, SuiviCampagne, AuditLog } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { DesactiverModal } from './DesactiverModal'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatDateTime } from '@/lib/utils'

interface DetailData {
  inventaire: Inventaire
  poste: Poste | null
  os: SystemeExploitation | null
  office: MicrosoftOffice | null
  campagnes: SuiviCampagne[]
  logs: AuditLog[]
}

function DetailRow({ label, value }: { label: string; value?: string | null | React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="w-36 flex-shrink-0 text-xs text-gray-500 font-medium">{label}</span>
      <span className="text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Icon size={15} className="text-primary-600" /> {title}
        </h2>
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

export function InventaireDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAssistant } = useAuth()
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deactivate, setDeactivate] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    const [
      { data: inv },
      { data: poste },
      { data: os },
      { data: office },
      { data: campagnes },
      { data: logs },
    ] = await Promise.all([
      supabase.from('inventaire').select('*').eq('id_materiel', id).single(),
      supabase.from('poste').select('*').eq('id_materiel', id).single(),
      supabase.from('systeme_exploitation').select('*').eq('id_materiel', id).single(),
      supabase.from('microsoft_office').select('*').eq('id_materiel', id).single(),
      supabase.from('suivi_campagne').select('*, campagne:campagnes(nom)').eq('id_materiel', id).order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').eq('id_enregistrement', id).order('date_action', { ascending: false }).limit(20),
    ])
    if (!inv) { navigate('/inventaire'); return }
    setDetail({
      inventaire: inv,
      poste: poste ?? null,
      os: os ?? null,
      office: office ?? null,
      campagnes: campagnes ?? [],
      logs: logs ?? [],
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return <PageLoader />
  if (!detail) return null

  const { inventaire: inv, poste, os, office, campagnes, logs } = detail

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
      {/* En-tête */}
      <div className="page-header">
        <div>
          <button onClick={() => navigate('/inventaire')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
            <ArrowLeft size={14} /> Inventaire
          </button>
          <h1 className="page-title font-mono">{inv.numero_inventaire ?? 'Sans numéro'}</h1>
          <p className="page-subtitle">{inv.marque_modele} · {inv.type_materiel}</p>
        </div>
        {isAssistant && inv.actif && (
          <div className="flex gap-2">
            <Link to={`/inventaire/${id}/modifier`} className="btn-secondary gap-2 text-sm">
              <Pencil size={15} /> Modifier
            </Link>
            <button onClick={() => setDeactivate(true)} className="btn-danger gap-2 text-sm">
              <PowerOff size={15} /> Désactiver
            </button>
          </div>
        )}
      </div>

      {!inv.actif && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <PowerOff size={15} />
          <span>Matériel désactivé le {formatDate(inv.date_desactivation)} — Motif : {inv.motif_desactivation}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Informations générales */}
        <Section title="Informations générales" icon={Laptop}>
          <DetailRow label="Type" value={inv.type_materiel} />
          <DetailRow label="N° Inventaire" value={<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{inv.numero_inventaire}</code>} />
          <DetailRow label="N° Série" value={<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{inv.numero_serie}</code>} />
          <DetailRow label="Marque / Modèle" value={inv.marque_modele} />
          <DetailRow label="Utilisateur" value={inv.utilisateur} />
          <DetailRow label="Matricule" value={inv.matricule} />
          <DetailRow label="Société" value={inv.societe} />
          <DetailRow label="Exploitation" value={inv.exploitation} />
          <DetailRow label="Localisation" value={inv.localisation} />
          <DetailRow label="État" value={<Badge value={inv.etat} />} />
          <DetailRow label="Statut" value={inv.actif
            ? <span className="badge bg-green-100 text-green-700">Actif</span>
            : <span className="badge bg-red-100 text-red-700">Désactivé</span>} />
        </Section>

        {/* Infos supplémentaires */}
        <div className="space-y-4">
          {/* Poste */}
          <Section title="Poste / Fonction" icon={Laptop}>
            {poste ? (
              <>
                <DetailRow label="Fonction" value={poste.fonction} />
                <DetailRow label="Type utilisation" value={poste.type_utilisation} />
                <DetailRow label="Observation" value={poste.observation} />
              </>
            ) : (
              <p className="text-sm text-gray-400">Aucune information de poste enregistrée.</p>
            )}
          </Section>

          {/* OS */}
          <Section title="Système d'exploitation" icon={Monitor}>
            {os ? (
              <>
                <DetailRow label="Statut" value={<Badge value={os.statut_systeme} />} />
                <DetailRow label="Modifié le" value={formatDate(os.date_modification)} />
                <DetailRow label="Observation" value={os.observation} />
              </>
            ) : (
              <p className="text-sm text-gray-400">Aucun suivi OS enregistré.</p>
            )}
          </Section>

          {/* Office */}
          <Section title="Microsoft Office" icon={FileText}>
            {office ? (
              <>
                <DetailRow label="Statut" value={<Badge value={office.statut_office} />} />
                <DetailRow label="Modifié le" value={formatDate(office.date_modification)} />
                <DetailRow label="Observation" value={office.observation} />
              </>
            ) : (
              <p className="text-sm text-gray-400">Aucun suivi Office enregistré.</p>
            )}
          </Section>
        </div>
      </div>

      {/* Campagnes */}
      {campagnes.length > 0 && (
        <Section title="Campagnes de migration" icon={BarChart3}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 pr-4 font-medium">Campagne</th>
                  <th className="text-left py-2 pr-4 font-medium">Statut</th>
                  <th className="text-left py-2 pr-4 font-medium">Traité le</th>
                  <th className="text-left py-2 font-medium">Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campagnes.map(c => (
                  <tr key={c.id_suivi}>
                    <td className="py-2 pr-4 font-medium">{(c.campagne as { nom?: string })?.nom ?? '—'}</td>
                    <td className="py-2 pr-4"><Badge value={c.statut} /></td>
                    <td className="py-2 pr-4 text-gray-500">{formatDate(c.date_traitement)}</td>
                    <td className="py-2 text-gray-500">{c.observation ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Observations */}
      {inv.observations && (
        <Section title="Observations" icon={BarChart3}>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{inv.observations}</p>
        </Section>
      )}

      {/* Historique */}
      {logs.length > 0 && (
        <Section title="Historique des modifications" icon={Clock}>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id_log} className="flex gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 w-32 flex-shrink-0">{formatDateTime(log.date_action)}</span>
                <span className={`badge text-xs flex-shrink-0 ${
                  log.action === 'CREATION' ? 'bg-green-100 text-green-700'
                  : log.action === 'DESACTIVATION' ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
                }`}>{log.action}</span>
                <span className="text-gray-600 text-xs truncate">{log.utilisateur ?? 'Système'}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <p className="text-xs text-gray-400 pb-4">
        Créé le {formatDateTime(inv.created_at)} · Modifié le {formatDateTime(inv.updated_at)}
      </p>

      <DesactiverModal
        materiel={deactivate ? inv : null}
        onClose={() => setDeactivate(false)}
        onSuccess={() => { setDeactivate(false); load() }}
      />
    </div>
  )
}
