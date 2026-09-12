import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface RefItem { value: string; label: string }

async function fetchRef(table: string): Promise<RefItem[]> {
  const { data } = await supabase
    .from(table)
    .select('valeur')
    .eq('actif', true)
    .order('ordre', { nullsFirst: false })
    .order('valeur')
  return data?.map(r => ({ value: r.valeur, label: r.valeur })) ?? []
}

export function useReferentiels() {
  const [refs, setRefs] = useState<{
    societes: RefItem[]
    exploitations: RefItem[]
    localisations: RefItem[]
    typesMateriel: RefItem[]
    marques: RefItem[]
    operateurs: RefItem[]
    fonctions: RefItem[]
    categoriesProbleme: RefItem[]
  }>({
    societes: [], exploitations: [], localisations: [],
    typesMateriel: [], marques: [], operateurs: [],
    fonctions: [], categoriesProbleme: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchRef('ref_societes'),
      fetchRef('ref_exploitations'),
      fetchRef('ref_localisations'),
      fetchRef('ref_types_materiel'),
      fetchRef('ref_marques'),
      fetchRef('ref_operateurs'),
      fetchRef('ref_fonctions'),
      fetchRef('ref_categories_probleme'),
    ]).then(([societes, exploitations, localisations, typesMateriel, marques, operateurs, fonctions, categoriesProbleme]) => {
      setRefs({ societes, exploitations, localisations, typesMateriel, marques, operateurs, fonctions, categoriesProbleme })
      setLoading(false)
    })
  }, [])

  return { ...refs, loading }
}
