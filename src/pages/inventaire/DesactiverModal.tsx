import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { supabase, logAudit } from '@/lib/supabase'
import type { Inventaire } from '@/types'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

const MOTIFS = [
  'Déposé au siège',
  'Racheté par l\'utilisateur',
  'Transféré hors zone',
  'Réformé',
  'Restitué',
  'Perdu de vue',
  'Autre',
]

interface Form {
  motif: string
  observation: string
}

interface Props {
  materiel: Inventaire | null
  onClose: () => void
  onSuccess: () => void
}

export function DesactiverModal({ materiel, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>()

  async function onSubmit(form: Form) {
    if (!materiel) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('inventaire')
        .update({
          actif: false,
          motif_desactivation: form.motif,
          observations: (materiel.observations ? materiel.observations + '\n' : '') +
            `[Désactivation] ${form.observation}`,
          date_desactivation: new Date().toISOString(),
          etat: 'Hors service',
          updated_by: user?.id,
        })
        .eq('id_materiel', materiel.id_materiel)

      if (error) throw error

      await logAudit({
        action: 'DESACTIVATION',
        table_concernee: 'inventaire',
        id_enregistrement: materiel.id_materiel,
        anciennes_valeurs: { actif: true, etat: materiel.etat },
        nouvelles_valeurs: { actif: false, motif: form.motif, observation: form.observation },
      })

      toast.success('Matériel désactivé avec succès')
      reset()
      onSuccess()
    } catch {
      toast.error('Erreur lors de la désactivation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={!!materiel}
      onClose={() => { reset(); onClose() }}
      title="Désactiver le matériel"
      size="md"
      footer={
        <>
          <button onClick={() => { reset(); onClose() }} className="btn-secondary" disabled={loading}>
            Annuler
          </button>
          <button form="deactivate-form" type="submit" className="btn-danger" disabled={loading}>
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Désactiver'}
          </button>
        </>
      }
    >
      {materiel && (
        <>
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Vous allez désactiver : <strong>{materiel.numero_inventaire ?? materiel.id_materiel}</strong>
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Le matériel sera masqué de l'inventaire actif mais conservé dans les archives.
              </p>
            </div>
          </div>

          <form id="deactivate-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label label-required">Motif de désactivation</label>
              <select
                className={`input ${errors.motif ? 'input-error' : ''}`}
                {...register('motif', { required: 'Le motif est requis' })}
              >
                <option value="">Sélectionner un motif…</option>
                {MOTIFS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {errors.motif && <p className="mt-1 text-xs text-danger-700">{errors.motif.message}</p>}
            </div>

            <div>
              <label className="label label-required">Observation</label>
              <textarea
                rows={3}
                placeholder="Détail de la désactivation…"
                className={`input resize-none ${errors.observation ? 'input-error' : ''}`}
                {...register('observation', { required: 'Une observation est requise' })}
              />
              {errors.observation && <p className="mt-1 text-xs text-danger-700">{errors.observation.message}</p>}
            </div>
          </form>
        </>
      )}
    </Modal>
  )
}
