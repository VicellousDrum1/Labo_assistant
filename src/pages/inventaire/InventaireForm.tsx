import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Save, ArrowLeft, AlertCircle } from 'lucide-react'
import { supabase, logAudit } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useReferentiels } from '@/hooks/useReferentiels'
import type { Inventaire } from '@/types'
import toast from 'react-hot-toast'

const ETATS = ['En service','En panne','Renouvelé','En réparation','En stock','Hors service','Réformé','Déposé au Siège','Volé']

type FormData = Omit<Inventaire,
  'id_materiel'|'actif'|'motif_desactivation'|'date_desactivation'|
  'created_at'|'updated_at'|'created_by'|'updated_by'
>

export function InventaireForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const refs = useReferentiels()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState<Inventaire | null>(null)

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (isEdit && id) {
      supabase.from('inventaire').select('*').eq('id_materiel', id).single()
        .then(({ data }) => {
          if (data) { setExisting(data); reset(data) }
          else navigate('/inventaire')
        })
    }
  }, [id, isEdit, reset, navigate])

  async function onSubmit(form: FormData) {
    setLoading(true)
    try {
      if (isEdit && existing) {
        // Vérifier doublon numéro inventaire (sauf soi-même)
        if (form.numero_inventaire) {
          const { data: dup } = await supabase
            .from('inventaire')
            .select('id_materiel')
            .eq('numero_inventaire', form.numero_inventaire)
            .neq('id_materiel', existing.id_materiel)
            .single()
          if (dup) {
            setError('numero_inventaire', { message: 'Ce numéro d\'inventaire existe déjà' })
            setLoading(false)
            return
          }
        }
        const { error } = await supabase
          .from('inventaire')
          .update({ ...form, updated_by: user?.id })
          .eq('id_materiel', existing.id_materiel)
        if (error) throw error
        await logAudit({
          action: 'MODIFICATION',
          table_concernee: 'inventaire',
          id_enregistrement: existing.id_materiel,
          anciennes_valeurs: existing as unknown as Record<string, unknown>,
          nouvelles_valeurs: form as unknown as Record<string, unknown>,
        })
        toast.success('Matériel mis à jour')
        navigate(`/inventaire/${existing.id_materiel}`)
      } else {
        // Vérifier doublon numéro inventaire
        if (form.numero_inventaire) {
          const { data: dup } = await supabase
            .from('inventaire')
            .select('id_materiel')
            .eq('numero_inventaire', form.numero_inventaire)
            .single()
          if (dup) {
            setError('numero_inventaire', { message: 'Ce numéro d\'inventaire existe déjà' })
            setLoading(false)
            return
          }
        }
        const { data, error } = await supabase
          .from('inventaire')
          .insert({ ...form, created_by: user?.id, updated_by: user?.id })
          .select()
          .single()
        if (error) throw error
        await logAudit({
          action: 'CREATION',
          table_concernee: 'inventaire',
          id_enregistrement: data.id_materiel,
          nouvelles_valeurs: form as unknown as Record<string, unknown>,
        })
        toast.success('Matériel créé avec succès')
        navigate(`/inventaire/${data.id_materiel}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Erreur : ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  function Field({ label, name, required, type = 'text', options, rows }: {
    label: string
    name: keyof FormData
    required?: boolean
    type?: string
    options?: string[]
    rows?: number
  }) {
    const err = errors[name]
    return (
      <div>
        <label className={`label ${required ? 'label-required' : ''}`}>{label}</label>
        {options ? (
          <select className={`input ${err ? 'input-error' : ''}`}
            {...register(name, required ? { required: `${label} est requis` } : {})}>
            <option value="">— Sélectionner —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : rows ? (
          <textarea rows={rows} className={`input resize-none ${err ? 'input-error' : ''}`}
            {...register(name)} />
        ) : (
          <input type={type} className={`input ${err ? 'input-error' : ''}`}
            {...register(name, required ? { required: `${label} est requis` } : {})} />
        )}
        {err && (
          <p className="mt-1 text-xs text-danger-700 flex items-center gap-1">
            <AlertCircle size={11} />{err.message}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="page-header">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
            <ArrowLeft size={14} /> Retour
          </button>
          <h1 className="page-title">{isEdit ? 'Modifier le matériel' : 'Nouveau matériel'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identification */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-gray-700">Identification</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Type de matériel" name="type_materiel" required
              options={refs.typesMateriel.map(r => r.value)} />
            <Field label="N° Inventaire" name="numero_inventaire" />
            <Field label="N° Série" name="numero_serie" />
            <Field label="Marque / Modèle" name="marque_modele" />
          </div>
        </div>

        {/* Affectation */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-gray-700">Affectation</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Utilisateur" name="utilisateur" />
            <Field label="Matricule" name="matricule" />
            <Field label="Société" name="societe" options={refs.societes.map(r => r.value)} />
            <Field label="Exploitation" name="exploitation" options={refs.exploitations.map(r => r.value)} />
            <Field label="Localisation" name="localisation" options={refs.localisations.map(r => r.value)} />
            <Field label="État" name="etat" required options={ETATS} />
          </div>
        </div>

        {/* Observations */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-gray-700">Observations</h2>
          </div>
          <div className="card-body">
            <Field label="Observations" name="observations" rows={4} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Save size={15} /> {isEdit ? 'Enregistrer' : 'Créer'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
