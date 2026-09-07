import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package, Wifi, Smartphone, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { debounce } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'inventaire' | 'tsp' | 'dualsim' | 'dids'
  label: string
  sublabel: string
  url: string
}

interface Props { onClose: () => void }

export function GlobalSearch({ onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const search = useCallback(
    debounce(async (q: string) => {
      if (q.trim().length < 2) { setResults([]); setLoading(false); return }
      setLoading(true)
      const like = `%${q}%`
      const all: SearchResult[] = []

      // Inventaire
      const { data: inv } = await supabase
        .from('inventaire')
        .select('id_materiel, numero_inventaire, numero_serie, utilisateur, marque_modele, etat')
        .or(`numero_inventaire.ilike.${like},numero_serie.ilike.${like},utilisateur.ilike.${like},matricule.ilike.${like},marque_modele.ilike.${like}`)
        .eq('actif', true)
        .limit(5)
      inv?.forEach(r => all.push({
        id: r.id_materiel,
        type: 'inventaire',
        label: r.numero_inventaire ?? r.numero_serie ?? 'Sans numéro',
        sublabel: [r.marque_modele, r.utilisateur, r.etat].filter(Boolean).join(' · '),
        url: `/inventaire/${r.id_materiel}`,
      }))

      // TSP
      const { data: tsps } = await supabase
        .from('tsp')
        .select('id_tsp, nom_prenoms, matricule, societe_entite, exploitation')
        .or(`nom_prenoms.ilike.${like},matricule.ilike.${like},numero_puce.ilike.${like}`)
        .eq('actif', true)
        .limit(3)
      tsps?.forEach(r => all.push({
        id: r.id_tsp,
        type: 'tsp',
        label: r.nom_prenoms,
        sublabel: [r.societe_entite, r.exploitation].filter(Boolean).join(' · '),
        url: `/tsp`,
      }))

      // Dual-SIM
      const { data: dsim } = await supabase
        .from('site_dualsim')
        .select('id_dualsim, site, utilisateur, numero_sim1, numero_sim2')
        .or(`site.ilike.${like},utilisateur.ilike.${like},numero_sim1.ilike.${like},numero_sim2.ilike.${like}`)
        .eq('actif', true)
        .limit(3)
      dsim?.forEach(r => all.push({
        id: r.id_dualsim,
        type: 'dualsim',
        label: r.site ?? r.utilisateur ?? 'Site inconnu',
        sublabel: [r.numero_sim1, r.numero_sim2].filter(Boolean).join(' / '),
        url: `/dual-sim`,
      }))

      // DI/DS
      const { data: dids } = await supabase
        .from('suivi_di_ds')
        .select('id_di_ds, type_demande, numero_demande, objet, statut')
        .or(`numero_demande.ilike.${like},demandeur.ilike.${like},objet.ilike.${like}`)
        .limit(3)
      dids?.forEach(r => all.push({
        id: r.id_di_ds,
        type: 'dids',
        label: `${r.type_demande} ${r.numero_demande ?? ''}`.trim(),
        sublabel: r.objet,
        url: `/di-ds`,
      }))

      setResults(all)
      setActiveIndex(-1)
      setLoading(false)
    }, 300),
    []
  )

  useEffect(() => { search(query) }, [query, search])

  // Réinitialise l'index actif quand les résultats changent
  useEffect(() => { setActiveIndex(-1) }, [results])

  // Scroll automatique sur l'élément actif
  useEffect(() => {
    if (activeIndex >= 0) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  function go(url: string) {
    navigate(url)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && results[activeIndex]) {
        go(results[activeIndex].url)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const icons: Record<string, React.ReactNode> = {
    inventaire: <Package size={15} />,
    tsp:        <Smartphone size={15} />,
    dualsim:    <Wifi size={15} />,
    dids:       <Package size={15} />,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-fade-in">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un matériel, utilisateur, numéro SIM…"
            className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
            aria-label="Recherche globale"
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          />
          <button onClick={onClose} className="btn-icon text-gray-400" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {/* Résultats */}
        <div ref={listRef} className="max-h-80 overflow-y-auto scrollbar-thin py-2" role="listbox">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Recherche…</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Aucun résultat pour « {query} »
            </div>
          )}
          {!loading && query.length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Saisissez au moins 2 caractères
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              id={`search-result-${i}`}
              ref={el => { itemRefs.current[i] = el }}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => go(r.url)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors
                ${i === activeIndex ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
            >
              <span className={`mt-0.5 flex-shrink-0 ${i === activeIndex ? 'text-primary-600' : 'text-gray-400'}`}>
                {icons[r.type]}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${i === activeIndex ? 'text-primary-800' : 'text-gray-800'}`}>
                  {r.label}
                </p>
                <p className="text-xs text-gray-500 truncate">{r.sublabel}</p>
              </div>
              <span className="ml-auto text-xs text-gray-300 capitalize">{r.type}</span>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 flex gap-4">
          <span>↑↓ naviguer</span>
          <span>↵ sélectionner</span>
          <span>Esc fermer</span>
        </div>
      </div>
    </div>
  )
}
