import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { FlaskConical, Eye, EyeOff, Lock, Mail, AlertCircle, ShieldCheck, BarChart3, Database } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface LoginForm {
  email: string
  password: string
}

export function LoginPage() {
  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    setErrorMsg('')
    const { error } = await signIn(data.email, data.password)
    setLoading(false)
    if (error) {
      const msg = error.message?.toLowerCase()
      if (msg?.includes('invalid') || msg?.includes('credentials')) {
        setErrorMsg('Email ou mot de passe incorrect.')
      } else if (msg?.includes('email not confirmed')) {
        setErrorMsg('Veuillez confirmer votre adresse e-mail.')
      } else {
        setErrorMsg('Une erreur est survenue. Veuillez réessayer.')
      }
      return
    }
    toast.success('Connexion réussie')
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute -top-36 -left-36 w-96 h-96 rounded-full bg-primary-600/25 blur-3xl" />
      <div className="absolute -bottom-36 right-0 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="relative w-full max-w-5xl grid lg:grid-cols-[1.1fr_.9fr] overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40">
        <section className="hidden lg:flex flex-col justify-between min-h-[620px] p-10 bg-gradient-to-br from-primary-700 via-primary-800 to-slate-950 text-white">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-white/12 border border-white/15 flex items-center justify-center mb-8"><FlaskConical size={26} /></div>
            <p className="text-primary-200 text-sm font-semibold tracking-[.18em] uppercase">Pilotage IT</p>
            <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight">Votre parc, avec une vision claire.</h1>
            <p className="mt-5 max-w-md text-primary-100/80 leading-relaxed">Centralisez l’inventaire, les interventions et les déploiements dans un espace de travail conçu pour les équipes terrain.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[[Database, 'Parc centralisé'], [BarChart3, 'Suivi instantané'], [ShieldCheck, 'Accès maîtrisé']].map(([Icon, label]) => {
              const FeatureIcon = Icon as typeof Database
              return <div key={label as string} className="rounded-2xl bg-white/8 border border-white/10 p-4"><FeatureIcon size={18} className="text-primary-200" /><p className="mt-5 text-xs font-medium">{label as string}</p></div>
            })}
          </div>
        </section>
        <section className="bg-white p-7 sm:p-10 lg:p-12 flex items-center">
          <div className="w-full">
        {/* Logo */}
        <div className="mb-8">
          <div className="lg:hidden inline-flex items-center justify-center w-11 h-11 bg-primary-700 rounded-xl mb-5 text-white shadow-lg shadow-primary-200">
            <FlaskConical size={22} />
          </div>
          <p className="text-primary-700 text-xs font-bold tracking-[.16em] uppercase">Le Labo de l’Assistant</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Bon retour parmi nous.</h1>
          <p className="text-slate-500 text-sm mt-2">Connectez-vous pour accéder à votre espace de pilotage.</p>
        </div>

        {/* Formulaire */}
        <div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label className="label" htmlFor="email">Adresse e-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nom@exemple.com"
                  className={cn('input pl-9', errors.email && 'input-error')}
                  {...register('email', {
                    required: 'L\'adresse e-mail est requise',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Adresse e-mail invalide'
                    }
                  })}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} />{errors.email.message}
                </p>
              )}
            </div>

            {/* Mot de passe */}
            <div>
              <label className="label" htmlFor="password">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn('input pl-9 pr-10', errors.password && 'input-error')}
                  {...register('password', { required: 'Le mot de passe est requis' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                             hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} />{errors.password.message}
                </p>
              )}
            </div>

            {/* Erreur globale */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200
                              rounded-lg text-sm text-red-700">
                <AlertCircle size={15} className="flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white
                                   rounded-full animate-spin" />
                  Connexion…
                </span>
              ) : 'Se connecter'}
            </button>
          </form>

          {/* Mot de passe oublié */}
          <p className="mt-4 text-center text-sm text-gray-500">
            Mot de passe oublié ?{' '}
            <a href="mailto:admin@labolabo.local"
               className="text-primary-700 hover:underline font-medium">
              Contacter l'administrateur
            </a>
          </p>
        </div>

        <p className="text-center text-primary-400 text-xs mt-6">
          © {new Date().getFullYear()} Le Labo de l'Assistant
        </p>
          </div>
        </section>
      </div>
    </div>
  )
}
