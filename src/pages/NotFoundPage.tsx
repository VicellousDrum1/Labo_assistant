import { useNavigate } from 'react-router-dom'
import { Home, AlertTriangle } from 'lucide-react'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100
                        rounded-3xl mb-6">
          <AlertTriangle size={36} className="text-amber-500" />
        </div>
        <h1 className="text-5xl font-black text-gray-900 mb-2">404</h1>
        <p className="text-lg text-gray-600 mb-6">Page introuvable</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          <Home size={16} />
          Retour au tableau de bord
        </button>
      </div>
    </div>
  )
}
