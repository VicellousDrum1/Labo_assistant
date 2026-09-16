// ============================================================================
// Edge Function : create-user
//
// Pourquoi cette fonction existe : créer un utilisateur "au nom" d'un admin
// ne doit JAMAIS se faire depuis le navigateur avec supabase.auth.signUp(),
// car cette méthode connecte automatiquement le navigateur avec le NOUVEAU
// compte créé — ce qui remplace silencieusement la session de l'admin en
// cours, et fait échouer l'écriture dans app_users (la policy RLS exige
// d'être administrateur au moment de l'insertion, or c'est alors le nouveau
// compte, sans rôle, qui est authentifié).
//
// Cette fonction tourne côté serveur avec la clé service_role (jamais
// exposée au navigateur) : elle vérifie d'abord que l'appelant est bien
// administrateur, puis crée le compte et sa fiche app_users sans jamais
// toucher à la session de qui que ce soit.
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Non authentifié')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client "appelant" : sert uniquement à vérifier QUI fait la demande,
    // avec ses propres droits (donc soumis à la RLS normale).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !caller) throw new Error('Session invalide')

    const { data: callerProfile, error: profileError } = await callerClient
      .from('app_users').select('role').eq('id', caller.id).single()
    if (profileError || callerProfile?.role !== 'administrateur') {
      throw new Error('Seul un administrateur peut créer un utilisateur')
    }

    const { email, password, nom_complet, role } = await req.json()
    if (!email || !password || !nom_complet || !role) {
      throw new Error('Champs manquants (email, password, nom_complet, role)')
    }

    // Client "admin" : clé service_role, ne touche à AUCUNE session existante.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password,
      email_confirm: true, // pas de mail de confirmation à valider, usage intranet
      user_metadata: { nom_complet, role },
    })
    if (createError) throw createError

    const { error: upsertError } = await adminClient.from('app_users').upsert({
      id: created.user.id, email, nom_complet, role, actif: true,
    }, { onConflict: 'id' })
    if (upsertError) throw upsertError

    return new Response(JSON.stringify({ success: true, id: created.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue'
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
