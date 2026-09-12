import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'
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
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950
                    flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-amber-500
                          rounded-2xl mb-4 data-value text-amber-500 text-xl font-semibold">
            LDA
          </div>
          <h1 className="text-2xl font-bold text-white">Le Labo de l'Assistant</h1>
          <p className="text-white/40 text-sm mt-1">Gestion du parc informatique</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-3xl shadow-soft p-8">
          <h2 className="text-lg font-extrabold text-graphite mb-6">Connexion</h2>

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
                <p className="mt-1 text-xs text-danger-700 flex items-center gap-1">
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
                <p className="mt-1 text-xs text-danger-700 flex items-center gap-1">
                  <AlertCircle size={12} />{errors.password.message}
                </p>
              )}
            </div>

            {/* Erreur globale */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-100
                              rounded-lg text-sm text-danger-700">
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
          <p className="mt-4 text-center text-sm text-slate font-medium">
            Mot de passe oublié ?{' '}
            <a href="mailto:admin@labolabo.local"
               className="text-blue-700 hover:underline font-bold">
              Contacter l'administrateur
            </a>
          </p>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          © {new Date().getFullYear()} Le Labo de l'Assistant
        </p>
      </div>
    </div>
  )
}
