# Le Labo de l'Assistant

Application web progressive (PWA) de gestion du parc informatique.

## Stack technique

| Couche      | Technologie |
|-------------|-------------|
| Frontend    | React 18 + TypeScript + Vite |
| Style       | Tailwind CSS |
| Backend/BDD | Supabase (PostgreSQL) |
| Auth        | Supabase Auth |
| PWA         | vite-plugin-pwa + Workbox |
| Hébergement | Cloudflare Pages |
| Source      | GitHub |

## Fonctionnalités

- **Inventaire** — gestion complète des matériels, désactivation logique, archives, fiche centralisée
- **Postes / Fonctions** — association PC ↔ fonction
- **Systèmes d'exploitation** — suivi des migrations OS
- **Microsoft Office** — suivi des migrations Office
- **Campagnes** — campagnes de migration génériques (OS, antivirus, logiciel…)
- **Guide de résolution** — base de connaissances techniques
- **Sites Dual-SIM** — suivi routeurs et cartes SIM
- **TSP** — suivi des terminaux et agents mobiles
- **Déploiement APK** — suivi du déploiement applicatif
- **DI/DS** — demandes d'intervention et de service
- **Tableau de bord** — KPIs, graphiques, filtres dynamiques
- **États & Rapports** — 17 rapports exportables (XLSX, CSV, PDF)
- **Recherche globale** — Ctrl+K, multi-tables
- **Audit** — journal complet de toutes les modifications
- **Administration** — utilisateurs, rôles, référentiels

## Importer les bases Excel existantes

Les imports sont disponibles pour l’**Inventaire**, le **suivi TSP**, les **sites Dual-SIM** et le **suivi DI/DS**, pour les rôles Assistant et Administrateur. Chaque écran propose un bouton `Importer` et un modèle téléchargeable.

- Formats acceptés : `.xlsx`, `.xls` et `.csv` (la première feuille est utilisée).
- Les en-têtes tolèrent les accents, la casse et plusieurs libellés usuels (`N° inv`, `Numéro inventaire`, `SN`, `Affectataire`, etc.).
- Un aperçu contrôle les champs obligatoires et affiche précisément les lignes rejetées avant l’écriture en base.
- Pour l’inventaire, un numéro d’inventaire déjà présent met à jour le matériel concerné ; les autres lignes créent un nouveau matériel.
- Toute création ou mise à jour d’import est journalisée dans l’audit.

Conservez les numéros d’inventaire et de demande tels qu’ils existent dans les fichiers de production : ils sont les meilleurs identifiants pour éviter les doublons.

## Installation

### 1. Prérequis

- Node.js 18+
- Compte Supabase
- Compte GitHub

### 2. Cloner et installer

```bash
git clone https://github.com/<votre-org>/le-labo-assistant.git
cd le-labo-assistant
npm install
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Renseignez dans `.env` :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> ⚠️ **Ne jamais** committer `.env`. La `service_role` key ne doit jamais être dans le code frontend.

### 4. Appliquer les migrations SQL

Dans l'interface Supabase > SQL Editor, exécuter dans l'ordre :

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls.sql`
3. `supabase/migrations/003_seed_referentiels.sql`

### 5. Lancer en développement

```bash
npm run dev
```

Application accessible sur `http://localhost:5173`

### 6. Build production

```bash
npm run build
```

## Déploiement Cloudflare Pages

1. Pusher le dépôt sur GitHub
2. Dans Cloudflare Pages > Create project > Connect to Git
3. Framework preset : **Vite**
4. Build command : `npm run build`
5. Build output directory : `dist`
6. Variables d'environnement : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
7. Déployer

Chaque push sur la branche de production déclenche automatiquement un déploiement.

## Structure du projet

```
├── src/
│   ├── components/
│   │   ├── layout/        # Layout, Sidebar, Header
│   │   ├── ui/            # Composants réutilisables
│   │   └── GlobalSearch   # Recherche globale
│   ├── context/           # AuthContext
│   ├── hooks/             # useReferentiels
│   ├── lib/               # supabase.ts, utils.ts
│   ├── pages/             # Pages par module
│   └── types/             # Types TypeScript
├── supabase/
│   └── migrations/        # Scripts SQL versionnés
├── public/                # Assets statiques
├── docs/                  # Documentation
├── .env.example
└── package.json
```

## Rôles utilisateurs

| Rôle           | Droits |
|----------------|--------|
| administrateur | Accès complet + admin + audit + suppression |
| assistant      | Lecture + création + modification |
| consultation   | Lecture seule |

## Modèle relationnel simplifié

```
inventaire
  ├── poste
  ├── systeme_exploitation
  ├── microsoft_office
  ├── site_dualsim
  ├── tsp → deploiement_apk
  └── suivi_campagne → campagnes

res_probleme
suivi_di_ds
audit_logs
app_users
ref_* (référentiels)
```

## Sécurité

- Row Level Security activé sur toutes les tables
- Clé publique (anon) uniquement côté client
- Service role key : fonctions Edge uniquement
- Sessions JWT avec expiration automatique
- Validation des entrées côté client et contraintes BDD
- Journalisation de toutes les actions sensibles

## Procédure de restauration

En cas de perte de données :

1. Supabase Dashboard > Backups > Restore point
2. Ou ré-appliquer les migrations + importer les exports CSV

## Évolutions prévues

L'architecture est conçue pour accueillir sans refonte :
- Gestion des imprimantes et consommables
- Licences logicielles
- Garanties fournisseurs
- QR Code matériels
- Photos / pièces jointes
- Notifications
- Module cartographique
