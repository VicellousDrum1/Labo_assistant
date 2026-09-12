import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { Dashboard } from '@/pages/Dashboard'
import { InventairePage } from '@/pages/inventaire/InventairePage'
import { InventaireForm } from '@/pages/inventaire/InventaireForm'
import { InventaireDetail } from '@/pages/inventaire/InventaireDetail'
import { InventaireArchives } from '@/pages/inventaire/InventaireArchives'
import { PostesPage } from '@/pages/postes/PostesPage'
import { SystemePage } from '@/pages/systeme/SystemePage'
import { OfficePage } from '@/pages/office/OfficePage'
import { CampagnesPage } from '@/pages/campagnes/CampagnesPage'
import { CampagneDetail } from '@/pages/campagnes/CampagneDetail'
import { ResolutionsPage } from '@/pages/resolutions/ResolutionsPage'
import { DualSimPage } from '@/pages/dualsim/DualSimPage'
import { TSPPage } from '@/pages/tsp/TSPPage'
import { APKPage } from '@/pages/apk/APKPage'
import { DiDsPage } from '@/pages/dids/DiDsPage'
import { RapportsPage } from '@/pages/rapports/RapportsPage'
import { AdminPage } from '@/pages/admin/AdminPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Chargement…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Inventaire */}
        <Route path="inventaire" element={<InventairePage />} />
        <Route path="inventaire/nouveau" element={<InventaireForm />} />
        <Route path="inventaire/:id" element={<InventaireDetail />} />
        <Route path="inventaire/:id/modifier" element={<InventaireForm />} />
        <Route path="inventaire/archives" element={<InventaireArchives />} />

        {/* Autres modules */}
        <Route path="postes" element={<PostesPage />} />
        <Route path="systeme" element={<SystemePage />} />
        <Route path="office" element={<OfficePage />} />
        <Route path="campagnes" element={<CampagnesPage />} />
        <Route path="campagnes/:id" element={<CampagneDetail />} />
        <Route path="resolutions" element={<ResolutionsPage />} />
        <Route path="dual-sim" element={<DualSimPage />} />
        <Route path="tsp" element={<TSPPage />} />
        <Route path="apk" element={<APKPage />} />
        <Route path="di-ds" element={<DiDsPage />} />
        <Route path="rapports" element={<RapportsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
