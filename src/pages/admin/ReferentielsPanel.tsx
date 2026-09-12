import { useState, useEffect } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

interface RefRow { id: string; valeur: string; description: string | null; actif: boolean; ordre: number | null }

const REFERENTIELS: { table: string; label: string; description: string }[] = [
  { table: 'ref_societes',            label: 'Sociétés',               description: 'Liste des sociétés' },
  { table: 'ref_exploitations',       label: 'Exploitations',          description: 'Zones / exploitations géographiques' },
  { table: 'ref_localisations',       label: 'Localisations',          description: 'Localisations physiques des équipements' },
  { table: 'ref_types_materiel',      label: 'Types de matériel',      description: 'Catégories de matériels' },
  { table: 'ref_marques',             label: 'Marques',                description: 'Marques de matériels' },
  { table: 'ref_operateurs',          label: 'Opérateurs télécom',     description: 'Opérateurs mobiles / SIM' },
  { table: 'ref_fonctions',           label: 'Fonctions de poste',     description: 'Types de postes informatiques' },
  { table: 'ref_categories_probleme', label: 'Catégories de problèmes', description: 'Catégories pour le guide de résolution' },
]

interface FormData { valeur: string; description: string; ordre: string }

export function ReferentielsPanel() {
  const [activeTable, setActiveTable] = useState(REFERENTIELS[0].table)
  const [data, setData] = useState<RefRow[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RefRow | null>(null)
  const [expanded, setExpanded] = useState<string | null>(REFERENTIELS[0].table)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  async function load(table: string) {
    setLoading(true)
    const { data } = await supabase.from(table).select('*').order('ordre', { nullsFirst: false }).order('valeur')
    setData(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load(activeTable) }, [activeTable])

  async function onSubmit(form: FormData) {
    try {
      if (editing) {
        await supabase.from(activeTable).update({ valeur: form.valeur, description: form.description || null, ordre: form.ordre ? Number(form.ordre) : null }).eq('id', editing.id)
        toast.success('Valeur mise à jour')
      } else {
        // Vérifier doublon
        const { data: dup } = await supabase.from(activeTable).select('id').eq('valeur', form.valeur).single()
        if (dup) { toast.error('Cette valeur existe déjà'); return }
        await supabase.from(activeTable).insert({ valeur: form.valeur, description: form.description || null, ordre: form.ordre ? Number(form.ordre) : null, actif: true })
        toast.success('Valeur ajoutée')
      }
      setModalOpen(false); reset(); load(activeTable)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  async function toggleActif(row: RefRow) {
    await supabase.from(activeTable).update({ actif: !row.actif }).eq('id', row.id)
    toast.success(row.actif ? 'Valeur désactivée' : 'Valeur réactivée')
    load(activeTable)
  }

  const activeRef = REFERENTIELS.find(r => r.table === activeTable)!

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Liste des référentiels */}
      <div className="card p-2 h-fit">
        {REFERENTIELS.map(ref => (
          <button
            key={ref.table}
            onClick={() => setActiveTable(ref.table)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTable === ref.table
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {ref.label}
          </button>
        ))}
      </div>

      {/* Contenu du référentiel actif */}
      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{activeRef.label}</h3>
            <p className="text-xs text-gray-500">{activeRef.description}</p>
          </div>
          <button onClick={() => { setEditing(null); reset({ valeur: '', description: '', ordre: '' }); setModalOpen(true) }} className="btn-primary text-sm gap-1.5">
            <Plus size={14} /> Ajouter
          </button>
        </div>

        <div className="card">
          {loading
            ? <div className="py-8 flex justify-center"><span className="w-6 h-6 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin" /></div>
            : data.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">Aucune valeur</p>
              : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Valeur</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">Ordre</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">Statut</th>
                      <th className="px-4 py-2.5 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map(row => (
                      <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${!row.actif ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{row.valeur}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{row.description ?? '—'}</td>
                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{row.ordre ?? '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`badge text-xs ${row.actif ? 'bg-ok-100 text-ok-700' : 'bg-gray-100 text-gray-500'}`}>
                            {row.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditing(row); reset({ valeur: row.valeur, description: row.description ?? '', ordre: row.ordre?.toString() ?? '' }); setModalOpen(true) }} className="btn-icon" title="Modifier"><Pencil size={13} /></button>
                            <button onClick={() => toggleActif(row)} className="btn-icon" title={row.actif ? 'Désactiver' : 'Activer'}>
                              {row.actif ? <ToggleRight size={14} className="text-ok-500" /> : <ToggleLeft size={14} className="text-gray-400" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          }
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }} size="sm"
        title={editing ? `Modifier — ${editing.valeur}` : `Ajouter dans ${activeRef.label}`}
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="ref-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="ref-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="label label-required">Valeur</label>
            <input className={`input ${errors.valeur ? 'input-error' : ''}`}
              {...register('valeur', { required: 'La valeur est requise' })} />
            {errors.valeur && <p className="mt-1 text-xs text-danger-700">{errors.valeur.message}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" {...register('description')} />
          </div>
          <div>
            <label className="label">Ordre d'affichage</label>
            <input type="number" className="input" placeholder="1, 2, 3…" {...register('ordre')} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
