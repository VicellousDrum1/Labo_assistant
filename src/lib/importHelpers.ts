// ============================================================================
// Utilitaires d'import en masse.
//
// Pourquoi ce fichier existe : la première version des imports (Inventaire,
// Postes, Systèmes, Office, Campagnes, TSP, Dual-SIM, DI/DS, APK, Résolutions)
// faisait une requête réseau PAR LIGNE et PAR VÉRIFICATION (doublon, lookup,
// insertion, audit), sans aucun timeout. Sur un gros fichier (600+ lignes) et
// une connexion instable, une seule requête bloquée gelait tout l'import
// indéfiniment (symptôme observé : import qui tourne "toute la nuit").
//
// Ces fonctions regroupent les vérifications et les insertions en quelques
// requêtes par lots (au lieu d'une par ligne) et appliquent un timeout à
// chaque appel réseau, pour qu'une requête défaillante échoue proprement
// au lieu de bloquer tout le reste.
//
// Note technique : le client Supabase n'est pas généré avec des types de
// schéma (pas de `Database` type), donc les appels `.from(nomDeTableVariable)`
// perdent l'inférence stricte. On caste volontairement en `any` à l'intérieur
// de ces fonctions génériques (elles manipulent des tables arbitraires par
// design) ; les signatures exposées à l'extérieur, elles, restent typées.
// ============================================================================
import { supabase } from './supabase'

const DEFAULT_TIMEOUT_MS = 15000
const CHUNK_SIZE = 100
const db = supabase as unknown as { from: (table: string) => any }

export class ImportTimeoutError extends Error {}

/** Fait échouer une promesse après `ms` millisecondes au lieu de bloquer indéfiniment. */
export function withTimeout<T = any>(promise: PromiseLike<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new ImportTimeoutError(
        `Délai réseau dépassé (${ms / 1000}s) — connexion trop lente ou requête bloquée`
      )), ms)
    ),
  ])
}

export function chunk<T>(arr: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Récupère en masse les valeurs déjà présentes en base pour une colonne
 * donnée (détection de doublons), en `Math.ceil(n/100)` requêtes au lieu
 * d'une par ligne importée.
 */
export async function fetchExistingSet(
  table: string, column: string, values: (string | null | undefined)[]
): Promise<Set<string>> {
  const clean = [...new Set(values.filter((v): v is string => !!v))]
  const found = new Set<string>()
  for (const batch of chunk(clean)) {
    const { data } = await withTimeout<{ data: Record<string, unknown>[] | null }>(
      db.from(table).select(column).in(column, batch)
    )
    ;(data ?? []).forEach((r: Record<string, unknown>) => found.add(String(r[column])))
  }
  return found
}

/**
 * Construit une correspondance valeur-clé -> ligne complète, en masse.
 * Sert à résoudre une référence (ex: numero_inventaire -> id_materiel)
 * sans faire une requête de lookup par ligne importée.
 */
export async function fetchLookupMap<T = Record<string, unknown>>(
  table: string, keyColumn: string, values: (string | null | undefined)[], select = '*'
): Promise<Map<string, T>> {
  const clean = [...new Set(values.filter((v): v is string => !!v))]
  const map = new Map<string, T>()
  for (const batch of chunk(clean)) {
    const { data } = await withTimeout<{ data: Record<string, unknown>[] | null }>(
      db.from(table).select(select).in(keyColumn, batch)
    )
    ;(data ?? []).forEach((r: Record<string, unknown>) => map.set(String(r[keyColumn]), r as T))
  }
  return map
}

export interface BatchInsertOutcome<T> {
  /** Lignes du lot effectivement créées, dans l'ordre du payload. */
  created: (T | null)[]
  /** Message d'erreur par index de ligne du lot (absent = succès). */
  errorsByIndex: Map<number, string>
}

/**
 * Insère un lot de lignes en une seule requête (au lieu d'un insert par
 * ligne). Si l'insertion groupée échoue (ex : une seule ligne viole une
 * contrainte), on retente les lignes UNE PAR UNE pour isoler précisément
 * la ou les lignes fautives sans perdre les lignes valides du lot.
 */
export async function batchInsert<T = Record<string, unknown>>(
  table: string, payloads: Record<string, unknown>[], select = '*'
): Promise<BatchInsertOutcome<T>> {
  const created: (T | null)[] = new Array(payloads.length).fill(null)
  const errorsByIndex = new Map<number, string>()

  for (const batch of chunk(payloads.map((p, i) => [i, p] as const))) {
    const values = batch.map(([, p]) => p)
    try {
      const { data, error } = await withTimeout<{ data: unknown[] | null; error: { message: string } | null }>(
        db.from(table).insert(values).select(select)
      )
      if (error) throw error
      batch.forEach(([origIdx], i) => { created[origIdx] = (data?.[i] as T) ?? null })
    } catch {
      // Le lot entier a échoué (souvent : une seule ligne en cause) →
      // on retente chaque ligne individuellement pour isoler le problème.
      for (const [origIdx, payload] of batch) {
        try {
          const { data, error } = await withTimeout<{ data: unknown; error: { message: string } | null }>(
            db.from(table).insert(payload).select(select).single()
          )
          if (error) throw error
          created[origIdx] = data as T
        } catch (e: unknown) {
          errorsByIndex.set(origIdx, e instanceof Error ? e.message : 'Erreur inconnue')
        }
      }
    }
  }
  return { created, errorsByIndex }
}

/** Insertion des logs d'audit en masse, en best-effort (un échec de log n'annule jamais l'import). */
export async function batchLogAudit(entries: Record<string, unknown>[]): Promise<void> {
  for (const batch of chunk(entries)) {
    try { await withTimeout(db.from('audit_logs').insert(batch)) }
    catch { /* best-effort : on ne bloque jamais l'import pour un souci de journalisation */ }
  }
}
