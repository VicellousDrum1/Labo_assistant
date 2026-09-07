// ============================================================
// TYPES CENTRAUX — Le Labo de l'Assistant
// ============================================================

export type UserRole = 'administrateur' | 'assistant' | 'consultation'

export interface AppUser {
  id: string
  email: string
  nom_complet: string
  role: UserRole
  actif: boolean
  created_at: string
}

// ---- INVENTAIRE ----
export type EtatMateriel =
  | 'En service'
  | 'En panne'
  | 'Renouvelé'
  | 'En réparation'
  | 'En stock'
  | 'Hors service'
  | 'Réformé'
  | 'Déposé au Siège'

export type TypeMateriel =
  | 'Ordinateur de bureau'
  | 'Ordinateur portable'
  | 'Imprimante simple'
  | 'Imprimante MFP'
  | 'Scanner'
  | 'Routeur'
  | 'Switch'
  | 'Téléphone'
  | 'Tablette'
  | 'TSP'
  | 'Onduleur'
  | 'Régulateur / Stabilisateur'
  | 'Borne Wi-Fi'
  | 'Autre'

export interface Inventaire {
  id_materiel: string
  type_materiel: string
  numero_inventaire: string | null
  societe: string | null
  numero_serie: string | null
  marque_modele: string | null
  etat: EtatMateriel
  utilisateur: string | null
  matricule: string | null
  localisation: string | null
  exploitation: string | null
  observations: string | null
  actif: boolean
  motif_desactivation: string | null
  date_desactivation: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

// ---- POSTE ----
export interface Poste {
  id_poste: string
  id_materiel: string
  fonction: string | null
  type_utilisation: string | null
  observation: string | null
  created_at: string
  updated_at: string
  inventaire?: Inventaire
}

// ---- SYSTÈME D'EXPLOITATION ----
export type StatutOS = 'Migré' | 'En cours de migration' | 'Non migré'

export interface SystemeExploitation {
  id_systeme: string
  id_materiel: string
  statut_systeme: StatutOS
  observation: string | null
  date_modification: string
  inventaire?: Inventaire
}

// ---- MICROSOFT OFFICE ----
export type StatutOffice = 'Migré' | 'En cours de migration' | 'Non migré'

export interface MicrosoftOffice {
  id_microsoft: string
  id_materiel: string
  statut_office: StatutOffice
  observation: string | null
  date_modification: string
  inventaire?: Inventaire
}

// ---- CAMPAGNES ----
export type StatutCampagne = 'Planifiée' | 'En cours' | 'Terminée' | 'Suspendue' | 'Annulée'

export interface Campagne {
  id_campagne: string
  nom: string
  description: string | null
  type_campagne: string | null
  date_debut: string | null
  date_fin_prevue: string | null
  statut: StatutCampagne
  actif: boolean
  created_by: string | null
  created_at: string
}

export type StatutSuiviCampagne =
  | 'Non démarré'
  | 'Planifié'
  | 'En cours'
  | 'Terminé'
  | 'Échec'
  | 'Non éligible'

export interface SuiviCampagne {
  id_suivi: string
  id_campagne: string
  id_materiel: string
  statut: StatutSuiviCampagne
  observation: string | null
  date_traitement: string | null
  traite_par: string | null
  created_at: string
  updated_at: string
  inventaire?: Inventaire
  campagne?: Campagne
}

// ---- RÉSOLUTION PROBLÈMES ----
export interface ResProbleme {
  id_resolution: string
  probleme: string
  solution_trouvee: string
  observation: string | null
  categorie: string | null
  mots_cles: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ---- DUAL-SIM ----
export interface SiteDualsim {
  id_dualsim: string
  utilisateur: string | null
  site: string | null
  societe: string | null
  adresse_routeur: string | null
  id_materiel: string | null
  numero_sim1: string | null
  operateur_sim1: string | null
  numero_sim2: string | null
  operateur_sim2: string | null
  observation: string | null
  actif: boolean
  created_at: string
  updated_at: string
  inventaire?: Inventaire
}

// ---- TSP ----
export interface TSP {
  id_tsp: string
  nom_prenoms: string
  matricule: string | null
  fonction: string | null
  societe_entite: string | null
  exploitation: string | null
  id_materiel: string | null
  numero_puce: string | null
  operateur: string | null
  observations: string | null
  actif: boolean
  created_at: string
  updated_at: string
  inventaire?: Inventaire
}

// ---- DÉPLOIEMENT APK ----
export type StatutDeploiement = 'Déployé' | 'Non déployé' | 'En cours'

export interface DeploiementApk {
  id_deploiement: string
  id_tsp: string
  statut_deploiement: StatutDeploiement
  observation: string | null
  date_deploiement: string | null
  deployed_by: string | null
  created_at: string
  updated_at: string
  tsp?: TSP
}

// ---- DI/DS ----
export type TypeDemande = 'DI' | 'DS'
export type StatutDiDs =
  | 'Nouveau'
  | 'Affecté'
  | 'En cours'
  | 'En attente'
  | 'Résolu'
  | 'Clôturé'
  | 'Annulé'
export type PrioriteDiDs = 'Faible' | 'Normale' | 'Haute' | 'Critique'

export interface SuiviDiDs {
  id_di_ds: string
  type_demande: TypeDemande
  numero_demande: string | null
  date_demande: string | null
  demandeur: string | null
  societe: string | null
  exploitation: string | null
  site: string | null
  objet: string
  priorite: PrioriteDiDs
  statut: StatutDiDs
  technicien: string | null
  date_cloture: string | null
  observation: string | null
  created_at: string
  updated_at: string
}

// ---- AUDIT LOGS ----
export interface AuditLog {
  id_log: string
  utilisateur: string | null
  action: string
  table_concernee: string
  id_enregistrement: string
  anciennes_valeurs: Record<string, unknown> | null
  nouvelles_valeurs: Record<string, unknown> | null
  date_action: string
}

// ---- RÉFÉRENTIELS ----
export interface Referentiel {
  id: string
  valeur: string
  description: string | null
  actif: boolean
  ordre: number | null
  created_at: string
}

// ---- FILTRES / PAGINATION ----
export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export interface FilterState {
  search?: string
  societe?: string
  exploitation?: string
  localisation?: string
  type_materiel?: string
  etat?: string
  actif?: boolean
}
