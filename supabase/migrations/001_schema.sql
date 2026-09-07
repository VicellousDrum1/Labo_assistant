-- ============================================================
-- MIGRATION 001 — SCHÉMA COMPLET
-- Le Labo de l'Assistant
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Recherche textuelle floue

-- ============================================================
-- TABLE : app_users (profils applicatifs)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  nom_complet   VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'consultation'
                  CHECK (role IN ('administrateur', 'assistant', 'consultation')),
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RÉFÉRENTIELS (listes administrables)
-- ============================================================
CREATE TABLE IF NOT EXISTS ref_societes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  valeur      VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ref_exploitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  valeur      VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ref_localisations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  valeur      VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ref_types_materiel (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  valeur      VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ref_marques (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  valeur      VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ref_operateurs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  valeur      VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ref_fonctions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  valeur      VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ref_categories_probleme (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  valeur      VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE PRINCIPALE : inventaire
-- ============================================================
CREATE TABLE IF NOT EXISTS inventaire (
  id_materiel          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_materiel        VARCHAR(100) NOT NULL,
  numero_inventaire    VARCHAR(100),
  societe              VARCHAR(255),
  numero_serie         VARCHAR(255),
  marque_modele        VARCHAR(255),
  etat                 VARCHAR(50) NOT NULL DEFAULT 'En service'
                         CHECK (etat IN (
                           'En service','En panne','Renouvelé',
                           'En réparation','En stock','Hors service',
                           'Réformé','Déposé au Siège'
                         )),
  utilisateur          VARCHAR(255),
  matricule            VARCHAR(100),
  localisation         VARCHAR(255),
  exploitation         VARCHAR(255),
  observations         TEXT,
  actif                BOOLEAN NOT NULL DEFAULT TRUE,
  motif_desactivation  TEXT,
  date_desactivation   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID REFERENCES auth.users(id),
  updated_by           UUID REFERENCES auth.users(id),
  CONSTRAINT uq_numero_inventaire UNIQUE (numero_inventaire)
);

-- Index performance inventaire
CREATE INDEX IF NOT EXISTS idx_inv_numero_inventaire ON inventaire(numero_inventaire);
CREATE INDEX IF NOT EXISTS idx_inv_numero_serie      ON inventaire(numero_serie);
CREATE INDEX IF NOT EXISTS idx_inv_matricule         ON inventaire(matricule);
CREATE INDEX IF NOT EXISTS idx_inv_societe           ON inventaire(societe);
CREATE INDEX IF NOT EXISTS idx_inv_exploitation      ON inventaire(exploitation);
CREATE INDEX IF NOT EXISTS idx_inv_etat              ON inventaire(etat);
CREATE INDEX IF NOT EXISTS idx_inv_localisation      ON inventaire(localisation);
CREATE INDEX IF NOT EXISTS idx_inv_actif             ON inventaire(actif);
CREATE INDEX IF NOT EXISTS idx_inv_type              ON inventaire(type_materiel);
-- Recherche textuelle full-text
CREATE INDEX IF NOT EXISTS idx_inv_search ON inventaire
  USING gin((
    to_tsvector('french',
      COALESCE(numero_inventaire,'') || ' ' ||
      COALESCE(numero_serie,'') || ' ' ||
      COALESCE(utilisateur,'') || ' ' ||
      COALESCE(matricule,'') || ' ' ||
      COALESCE(marque_modele,'') || ' ' ||
      COALESCE(societe,'') || ' ' ||
      COALESCE(exploitation,'')
    )
  ));

-- ============================================================
-- TABLE : poste
-- ============================================================
CREATE TABLE IF NOT EXISTS poste (
  id_poste         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_materiel      UUID NOT NULL REFERENCES inventaire(id_materiel) ON DELETE RESTRICT,
  fonction         VARCHAR(255),
  type_utilisation VARCHAR(100),
  observation      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_poste_materiel UNIQUE (id_materiel)
);
CREATE INDEX IF NOT EXISTS idx_poste_materiel ON poste(id_materiel);

-- ============================================================
-- TABLE : systeme_exploitation
-- ============================================================
CREATE TABLE IF NOT EXISTS systeme_exploitation (
  id_systeme        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_materiel       UUID NOT NULL REFERENCES inventaire(id_materiel) ON DELETE RESTRICT,
  statut_systeme    VARCHAR(50) NOT NULL DEFAULT 'Non migré'
                      CHECK (statut_systeme IN ('Migré','En cours de migration','Non migré')),
  observation       TEXT,
  date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sys_materiel UNIQUE (id_materiel)
);
CREATE INDEX IF NOT EXISTS idx_sys_materiel ON systeme_exploitation(id_materiel);
CREATE INDEX IF NOT EXISTS idx_sys_statut   ON systeme_exploitation(statut_systeme);

-- ============================================================
-- TABLE : microsoft_office
-- ============================================================
CREATE TABLE IF NOT EXISTS microsoft_office (
  id_microsoft      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_materiel       UUID NOT NULL REFERENCES inventaire(id_materiel) ON DELETE RESTRICT,
  statut_office     VARCHAR(50) NOT NULL DEFAULT 'Non migré'
                      CHECK (statut_office IN ('Migré','En cours de migration','Non migré')),
  observation       TEXT,
  date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_office_materiel UNIQUE (id_materiel)
);
CREATE INDEX IF NOT EXISTS idx_office_materiel ON microsoft_office(id_materiel);
CREATE INDEX IF NOT EXISTS idx_office_statut   ON microsoft_office(statut_office);

-- ============================================================
-- TABLE : campagnes
-- ============================================================
CREATE TABLE IF NOT EXISTS campagnes (
  id_campagne    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom            VARCHAR(255) NOT NULL,
  description    TEXT,
  type_campagne  VARCHAR(100),
  date_debut     DATE,
  date_fin_prevue DATE,
  statut         VARCHAR(50) NOT NULL DEFAULT 'Planifiée'
                   CHECK (statut IN ('Planifiée','En cours','Terminée','Suspendue','Annulée')),
  actif          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_camp_statut ON campagnes(statut);
CREATE INDEX IF NOT EXISTS idx_camp_actif  ON campagnes(actif);

-- ============================================================
-- TABLE : suivi_campagne
-- ============================================================
CREATE TABLE IF NOT EXISTS suivi_campagne (
  id_suivi        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_campagne     UUID NOT NULL REFERENCES campagnes(id_campagne) ON DELETE CASCADE,
  id_materiel     UUID NOT NULL REFERENCES inventaire(id_materiel) ON DELETE RESTRICT,
  statut          VARCHAR(50) NOT NULL DEFAULT 'Non démarré'
                    CHECK (statut IN (
                      'Non démarré','Planifié','En cours',
                      'Terminé','Échec','Non éligible'
                    )),
  observation     TEXT,
  date_traitement TIMESTAMPTZ,
  traite_par      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_suivi_camp_mat UNIQUE (id_campagne, id_materiel)
);
CREATE INDEX IF NOT EXISTS idx_suivi_campagne  ON suivi_campagne(id_campagne);
CREATE INDEX IF NOT EXISTS idx_suivi_materiel  ON suivi_campagne(id_materiel);
CREATE INDEX IF NOT EXISTS idx_suivi_statut    ON suivi_campagne(statut);

-- ============================================================
-- TABLE : res_probleme
-- ============================================================
CREATE TABLE IF NOT EXISTS res_probleme (
  id_resolution  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  probleme       TEXT NOT NULL,
  solution_trouvee TEXT NOT NULL,
  observation    TEXT,
  categorie      VARCHAR(100),
  mots_cles      VARCHAR(500),
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_res_categorie ON res_probleme(categorie);
CREATE INDEX IF NOT EXISTS idx_res_search ON res_probleme
  USING gin(to_tsvector('french',
    COALESCE(probleme,'') || ' ' ||
    COALESCE(solution_trouvee,'') || ' ' ||
    COALESCE(mots_cles,'')
  ));

-- ============================================================
-- TABLE : site_dualsim
-- ============================================================
CREATE TABLE IF NOT EXISTS site_dualsim (
  id_dualsim       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  utilisateur      VARCHAR(255),
  site             VARCHAR(255),
  societe          VARCHAR(255),
  adresse_routeur  VARCHAR(100),
  id_materiel      UUID REFERENCES inventaire(id_materiel) ON DELETE SET NULL,
  numero_sim1      VARCHAR(50),
  operateur_sim1   VARCHAR(100),
  numero_sim2      VARCHAR(50),
  operateur_sim2   VARCHAR(100),
  observation      TEXT,
  actif            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dsim_materiel   ON site_dualsim(id_materiel);
CREATE INDEX IF NOT EXISTS idx_dsim_actif      ON site_dualsim(actif);
CREATE INDEX IF NOT EXISTS idx_dsim_operateur1 ON site_dualsim(operateur_sim1);
CREATE INDEX IF NOT EXISTS idx_dsim_operateur2 ON site_dualsim(operateur_sim2);

-- ============================================================
-- TABLE : tsp
-- ============================================================
CREATE TABLE IF NOT EXISTS tsp (
  id_tsp          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom_prenoms     VARCHAR(255) NOT NULL,
  matricule       VARCHAR(100),
  fonction        VARCHAR(255),
  societe_entite  VARCHAR(255),
  exploitation    VARCHAR(255),
  id_materiel     UUID REFERENCES inventaire(id_materiel) ON DELETE SET NULL,
  numero_puce     VARCHAR(50),
  operateur       VARCHAR(100),
  observations    TEXT,
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tsp_materiel    ON tsp(id_materiel);
CREATE INDEX IF NOT EXISTS idx_tsp_actif       ON tsp(actif);
CREATE INDEX IF NOT EXISTS idx_tsp_societe     ON tsp(societe_entite);
CREATE INDEX IF NOT EXISTS idx_tsp_exploitation ON tsp(exploitation);
CREATE INDEX IF NOT EXISTS idx_tsp_operateur   ON tsp(operateur);

-- ============================================================
-- TABLE : deploiement_apk
-- ============================================================
CREATE TABLE IF NOT EXISTS deploiement_apk (
  id_deploiement     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_tsp             UUID NOT NULL REFERENCES tsp(id_tsp) ON DELETE CASCADE,
  statut_deploiement VARCHAR(50) NOT NULL DEFAULT 'Non déployé'
                       CHECK (statut_deploiement IN ('Déployé','Non déployé','En cours')),
  observation        TEXT,
  date_deploiement   TIMESTAMPTZ,
  deployed_by        UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_apk_tsp UNIQUE (id_tsp)
);
CREATE INDEX IF NOT EXISTS idx_apk_tsp    ON deploiement_apk(id_tsp);
CREATE INDEX IF NOT EXISTS idx_apk_statut ON deploiement_apk(statut_deploiement);

-- ============================================================
-- TABLE : suivi_di_ds
-- ============================================================
CREATE TABLE IF NOT EXISTS suivi_di_ds (
  id_di_ds       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_demande   VARCHAR(10) NOT NULL CHECK (type_demande IN ('DI','DS')),
  numero_demande VARCHAR(100),
  date_demande   DATE,
  demandeur      VARCHAR(255),
  societe        VARCHAR(255),
  exploitation   VARCHAR(255),
  site           VARCHAR(255),
  objet          TEXT NOT NULL,
  priorite       VARCHAR(20) NOT NULL DEFAULT 'Normale'
                   CHECK (priorite IN ('Faible','Normale','Haute','Critique')),
  statut         VARCHAR(30) NOT NULL DEFAULT 'Nouveau'
                   CHECK (statut IN (
                     'Nouveau','Affecté','En cours','En attente',
                     'Résolu','Clôturé','Annulé'
                   )),
  technicien     VARCHAR(255),
  date_cloture   DATE,
  observation    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dids_statut      ON suivi_di_ds(statut);
CREATE INDEX IF NOT EXISTS idx_dids_priorite    ON suivi_di_ds(priorite);
CREATE INDEX IF NOT EXISTS idx_dids_type        ON suivi_di_ds(type_demande);
CREATE INDEX IF NOT EXISTS idx_dids_exploitation ON suivi_di_ds(exploitation);

-- ============================================================
-- TABLE : audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id_log            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  utilisateur       UUID REFERENCES auth.users(id),
  action            VARCHAR(50) NOT NULL,
  table_concernee   VARCHAR(100) NOT NULL,
  id_enregistrement VARCHAR(255) NOT NULL,
  anciennes_valeurs JSONB,
  nouvelles_valeurs JSONB,
  date_action       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_utilisateur   ON audit_logs(utilisateur);
CREATE INDEX IF NOT EXISTS idx_audit_table         ON audit_logs(table_concernee);
CREATE INDEX IF NOT EXISTS idx_audit_date          ON audit_logs(date_action DESC);
CREATE INDEX IF NOT EXISTS idx_audit_enregistrement ON audit_logs(id_enregistrement);

-- ============================================================
-- TRIGGERS : updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inv_updated_at     BEFORE UPDATE ON inventaire          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_poste_updated_at   BEFORE UPDATE ON poste               FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_suivi_updated_at   BEFORE UPDATE ON suivi_campagne       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_res_updated_at     BEFORE UPDATE ON res_probleme         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_dsim_updated_at    BEFORE UPDATE ON site_dualsim         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tsp_updated_at     BEFORE UPDATE ON tsp                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_apk_updated_at     BEFORE UPDATE ON deploiement_apk      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_dids_updated_at    BEFORE UPDATE ON suivi_di_ds          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at   BEFORE UPDATE ON app_users            FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger auto-create app_users depuis auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app_users (id, email, nom_complet, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'consultation')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
