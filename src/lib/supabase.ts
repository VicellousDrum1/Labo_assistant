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
/**
 * Récupère TOUTES les lignes d'une requête, en dépassant la limite par
 * défaut de Supabase (1000 lignes par requête). Sans cette pagination,
 * toute page qui fait un select('*') sur une table de plus de 1000 lignes
 * (inventaire, tsp, site_dualsim...) reçoit silencieusement un sous-ensemble
 * tronqué — sans erreur, juste des chiffres faux. C'est ce qui causait les
 * écarts entre les statistiques du tableau de bord et la réalité du terrain
 * une fois le parc au-delà de 1000 équipements.
 *
 * Usage : passer une fonction qui (re)construit la requête à chaque appel
 * (car `.range()` doit être appliqué sur une requête fraîche) :
 *   const rows = await fetchAllRows<Inventaire>(() => {
 *     let q = supabase.from('inventaire').select('*')
 *     if (filtre) q = q.eq('societe', filtre)
 *     return q
 *   })
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  buildQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

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
