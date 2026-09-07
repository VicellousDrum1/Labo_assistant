import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables d\'environnement Supabase manquantes.\n' +
    'Copiez .env.example en .env et renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Helper : log d'audit centralisé
export async function logAudit(params: {
  action: string
  table_concernee: string
  id_enregistrement: string
  anciennes_valeurs?: Record<string, unknown> | null
  nouvelles_valeurs?: Record<string, unknown> | null
}) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('audit_logs').insert({
    utilisateur: user?.id ?? null,
    action: params.action,
    table_concernee: params.table_concernee,
    id_enregistrement: params.id_enregistrement,
    anciennes_valeurs: params.anciennes_valeurs ?? null,
    nouvelles_valeurs: params.nouvelles_valeurs ?? null,
  })
}
