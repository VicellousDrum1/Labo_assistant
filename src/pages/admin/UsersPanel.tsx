import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, UserCheck, UserX } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import type { AppUser, UserRole } from '@/types'
import { Table, type Column } from '@/components/ui/Table'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { SearchInput } from '@/components/ui/SearchInput'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'administrateur', label: 'Administrateur' },
  { value: 'assistant',      label: 'Assistant' },
  { value: 'consultation',   label: 'Consultation' },
]

interface FormData {
  email: string
  nom_complet: string
  role: UserRole
  password?: string
}

export function UsersPanel() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AppUser | null>(null)
  const [toggleLoading, setToggleLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('app_users').select('*').order('nom_complet')
    if (search.trim()) q = q.or(`nom_complet.ilike.%${search}%,email.ilike.%${search}%`)
    const { data } = await q
    setUsers(data ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  async function onSubmit(form: FormData) {
    try {
      if (editing) {
        const { error } = await supabase.from('app_users')
          .update({ nom_complet: form.nom_complet, role: form.role })
          .eq('id', editing.id)
        if (error) throw error
        toast.success('Utilisateur mis à jour')
      } else {
        // Création via une fonction serveur dédiée (supabase/functions/create-user) :
        // supabase.auth.signUp() côté navigateur ne convient pas ici, car il
        // connecte automatiquement le navigateur avec le NOUVEAU compte créé,
        // ce qui remplace la session de l'admin en cours et fait échouer
        // l'écriture dans app_users (RLS exige d'être administrateur au
        // moment de l'insertion).
        const { data: sessionData } = await supabase.auth.getSession()
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: form.email,
            password: form.password,
            nom_complet: form.nom_complet,
            role: form.role,
          },
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
        })
        if (error) throw error
        if (data?.success === false) throw new Error(data.error ?? 'Erreur lors de la création')

        toast.success('Utilisateur créé — il peut se connecter immédiatement')
      }
      setModalOpen(false)
      reset()
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function handleToggle() {
    if (!toggleTarget) return
    setToggleLoading(true)
    try {
      await supabase.from('app_users').update({ actif: !toggleTarget.actif }).eq('id', toggleTarget.id)
      toast.success(toggleTarget.actif ? 'Utilisateur désactivé' : 'Utilisateur réactivé')
      setToggleTarget(null)
      load()
    } catch { toast.error('Erreur') }
    finally { setToggleLoading(false) }
  }

  const roleLabel: Record<string, string> = {
    administrateur: 'Administrateur',
    assistant: 'Assistant',
    consultation: 'Consultation',
  }

  const roleBadge: Record<string, string> = {
    administrateur: 'bg-danger-100 text-danger-700',
    assistant: 'bg-info-100 text-info-700',
    consultation: 'bg-gray-100 text-gray-600',
  }

  const columns: Column<AppUser>[] = [
    { key: 'nom_complet', header: 'Nom complet', sortable: true,
      render: r => <span className="font-medium">{r.nom_complet}</span> },
    { key: 'email', header: 'Email', render: r => <span className="text-sm text-gray-600">{r.email}</span> },
    { key: 'role', header: 'Rôle', render: r => <span className={`badge ${roleBadge[r.role] ?? 'bg-gray-100 text-gray-600'}`}>{roleLabel[r.role] ?? r.role}</span> },
    { key: 'actif', header: 'Statut', render: r => <span className={`badge ${r.actif ? 'bg-ok-100 text-ok-700' : 'bg-danger-100 text-danger-700'}`}>{r.actif ? 'Actif' : 'Désactivé'}</span> },
    { key: 'created_at', header: 'Créé le', render: r => <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span> },
    { key: 'actions', header: '', className: 'w-20 text-right',
      render: r => (
        <div className="flex justify-end gap-1">
          <button onClick={() => { setEditing(r); reset({ nom_complet: r.nom_complet, role: r.role }); setModalOpen(true) }} className="btn-icon"><Pencil size={14} /></button>
          <button onClick={() => setToggleTarget(r)} className={`btn-icon ${r.actif ? 'text-danger-500 hover:bg-danger-50 hover:text-danger-700' : 'text-ok-500 hover:bg-ok-50 hover:text-ok-700'}`} title={r.actif ? 'Désactiver' : 'Réactiver'}>
            {r.actif ? <UserX size={14} /> : <UserCheck size={14} />}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <SearchInput value={search} onChange={v => setSearch(v)} placeholder="Nom, email…" className="flex-1" />
        <button onClick={() => { setEditing(null); reset({ email: '', nom_complet: '', role: 'consultation', password: '' }); setModalOpen(true) }} className="btn-primary text-sm gap-1.5">
          <Plus size={14} /> Nouvel utilisateur
        </button>
      </div>

      <div className="card">
        <Table columns={columns} data={users} loading={loading} rowKey={r => r.id} />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }}
        title={editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        footer={<><button onClick={() => { setModalOpen(false); reset() }} className="btn-secondary">Annuler</button><button form="user-form" type="submit" className="btn-primary">Enregistrer</button></>}>
        <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editing && (
            <div>
              <label className="label label-required">Email</label>
              <input type="email" className={`input ${errors.email ? 'input-error' : ''}`}
                {...register('email', { required: 'Email requis', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' } })} />
              {errors.email && <p className="mt-1 text-xs text-danger-700">{errors.email.message}</p>}
            </div>
          )}
          <div>
            <label className="label label-required">Nom complet</label>
            <input className={`input ${errors.nom_complet ? 'input-error' : ''}`}
              {...register('nom_complet', { required: 'Nom requis' })} />
            {errors.nom_complet && <p className="mt-1 text-xs text-danger-700">{errors.nom_complet.message}</p>}
          </div>
          <div>
            <label className="label label-required">Rôle</label>
            <select className="input" {...register('role', { required: true })}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {!editing && (
            <div>
              <label className="label label-required">Mot de passe initial</label>
              <input type="password" className={`input ${errors.password ? 'input-error' : ''}`}
                {...register('password', { required: 'Mot de passe requis', minLength: { value: 8, message: '8 caractères minimum' } })} />
              {errors.password && <p className="mt-1 text-xs text-danger-700">{errors.password.message}</p>}
              <p className="mt-1.5 text-xs text-slate bg-canvas-a rounded-lg px-3 py-2">
                L'utilisateur pourra se connecter immédiatement avec ces identifiants, sans confirmation d'email requise.
              </p>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        loading={toggleLoading}
        title={toggleTarget?.actif ? 'Désactiver l\'utilisateur' : 'Réactiver l\'utilisateur'}
        message={`${toggleTarget?.actif ? 'Désactiver' : 'Réactiver'} "${toggleTarget?.nom_complet}" ?`}
        confirmLabel={toggleTarget?.actif ? 'Désactiver' : 'Réactiver'}
        danger={toggleTarget?.actif}
      />
    </div>
  )
}
