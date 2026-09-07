# Schéma relationnel — Le Labo de l'Assistant

## Principe central

L'inventaire est la **source unique de vérité**.
Tous les modules référencent `inventaire.id_materiel` par clé étrangère.
Aucune information commune (n° inventaire, n° série, modèle) n'est dupliquée.

## Diagramme

```
┌─────────────────────────────────────────────────────────────────┐
│                         INVENTAIRE                              │
│  id_materiel (PK) · type_materiel · numero_inventaire (UNIQUE) │
│  societe · utilisateur · matricule · exploitation · etat        │
│  actif · motif_desactivation · date_desactivation               │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ├─────────────────┐
           │                 │
    ┌──────▼──────┐   ┌──────▼──────────────────┐
    │    POSTE    │   │  SYSTEME_EXPLOITATION    │
    │  id_poste   │   │  id_systeme              │
    │  id_materiel│   │  id_materiel             │
    │  fonction   │   │  statut_systeme           │
    └─────────────┘   └──────────────────────────┘
           │
           ├─────────────────┐
           │                 │
    ┌──────▼──────┐   ┌──────▼──────────────────┐
    │ MICROSOFT   │   │    SITE_DUALSIM          │
    │ OFFICE      │   │  id_dualsim              │
    │ id_microsoft│   │  id_materiel             │
    │ id_materiel │   │  numero_sim1/2           │
    └─────────────┘   └──────────────────────────┘
           │
           ├─────────────────┐
           │                 │
    ┌──────▼──────┐   ┌──────▼──────────────────┐
    │    TSP      │   │    SUIVI_CAMPAGNE         │
    │  id_tsp     │   │  id_suivi                │
    │  id_materiel│   │  id_campagne (FK)        │
    └──────┬──────┘   │  id_materiel             │
           │          └──────────────────────────┘
    ┌──────▼──────┐          │
    │ DEPLOIEMENT │   ┌──────▼──────────────────┐
    │    APK      │   │      CAMPAGNES           │
    │ id_deploiement  │  id_campagne             │
    │ id_tsp (FK) │   │  nom · statut · type     │
    └─────────────┘   └──────────────────────────┘

Tables indépendantes :
  RES_PROBLEME   — guide de résolution
  SUIVI_DI_DS    — demandes DI/DS
  AUDIT_LOGS     — journal des modifications
  APP_USERS      — profils applicatifs

Référentiels administrables :
  ref_societes · ref_exploitations · ref_localisations
  ref_types_materiel · ref_marques · ref_operateurs
  ref_fonctions · ref_categories_probleme
```

## Contraintes d'intégrité

| Table | Contrainte | Description |
|-------|-----------|-------------|
| inventaire | UNIQUE(numero_inventaire) | Pas de doublon N° inventaire |
| poste | UNIQUE(id_materiel) | Un seul poste par matériel |
| systeme_exploitation | UNIQUE(id_materiel) | Un seul suivi OS par matériel |
| microsoft_office | UNIQUE(id_materiel) | Un seul suivi Office par matériel |
| suivi_campagne | UNIQUE(id_campagne, id_materiel) | Un matériel une fois par campagne |
| deploiement_apk | UNIQUE(id_tsp) | Un seul suivi APK par TSP |
| inventaire | CHECK(etat IN ...) | États autorisés uniquement |
| suivi_campagne | CHECK(statut IN ...) | Statuts campagne autorisés |
| suivi_di_ds | CHECK(priorite IN ...) | Priorités autorisées |

## Index de performance

Tous les champs de filtrage et de jointure sont indexés :
- `inventaire` : numero_inventaire, numero_serie, matricule, societe, exploitation, etat, actif, type_materiel, + index GIN full-text
- `suivi_campagne` : id_campagne, id_materiel, statut
- `suivi_di_ds` : statut, priorite, type_demande, exploitation
- `tsp` : id_materiel, actif, societe_entite, exploitation, operateur
- `audit_logs` : utilisateur, table_concernee, date_action DESC, id_enregistrement

## Row Level Security

Toutes les tables ont RLS activé.

| Rôle | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| administrateur | ✅ tout | ✅ | ✅ | ✅ logique |
| assistant | ✅ actifs | ✅ | ✅ | ❌ |
| consultation | ✅ actifs | ❌ | ❌ | ❌ |

La fonction `get_user_role()` est appelée par les politiques RLS pour déterminer le rôle sans requête supplémentaire.
