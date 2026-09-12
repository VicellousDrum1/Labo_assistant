-- ============================================================
-- MIGRATION 002 — ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE app_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaire         ENABLE ROW LEVEL SECURITY;
ALTER TABLE poste              ENABLE ROW LEVEL SECURITY;
ALTER TABLE systeme_exploitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsoft_office   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campagnes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE suivi_campagne     ENABLE ROW LEVEL SECURITY;
ALTER TABLE res_probleme       ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_dualsim       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsp                ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploiement_apk    ENABLE ROW LEVEL SECURITY;
ALTER TABLE suivi_di_ds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_societes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_exploitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_localisations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_types_materiel ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_marques        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_operateurs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_fonctions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_categories_probleme ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER : récupérer le rôle de l'utilisateur connecté
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM app_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- POLITIQUES : app_users
-- ============================================================
CREATE POLICY "Utilisateurs peuvent voir leur propre profil"
  ON app_users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admin peut voir tous les profils"
  ON app_users FOR SELECT
  USING (get_user_role() = 'administrateur');

CREATE POLICY "Admin peut modifier les utilisateurs"
  ON app_users FOR UPDATE
  USING (get_user_role() = 'administrateur');

CREATE POLICY "Admin peut créer des utilisateurs"
  ON app_users FOR INSERT
  WITH CHECK (get_user_role() = 'administrateur');

-- ============================================================
-- POLITIQUES : inventaire
-- ============================================================

-- Lecture : tous les utilisateurs authentifiés
CREATE POLICY "Tous peuvent lire l'inventaire"
  ON inventaire FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insertion : admin et assistant
CREATE POLICY "Admin et assistant peuvent créer du matériel"
  ON inventaire FOR INSERT
  WITH CHECK (get_user_role() IN ('administrateur', 'assistant'));

-- Mise à jour : admin et assistant
CREATE POLICY "Admin et assistant peuvent modifier du matériel"
  ON inventaire FOR UPDATE
  USING (get_user_role() IN ('administrateur', 'assistant'));

-- Suppression physique : admin uniquement (désactivation préférée)
CREATE POLICY "Seul l'admin peut supprimer physiquement"
  ON inventaire FOR DELETE
  USING (get_user_role() = 'administrateur');

-- ============================================================
-- POLITIQUES GÉNÉRIQUES : tables de suivi
-- (poste, systeme_exploitation, microsoft_office, suivi_campagne,
--  site_dualsim, tsp, deploiement_apk, suivi_di_ds, res_probleme)
-- ============================================================

-- Fonction réutilisable pour les tables de suivi
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'poste', 'systeme_exploitation', 'microsoft_office',
    'campagnes', 'suivi_campagne', 'res_probleme',
    'site_dualsim', 'tsp', 'deploiement_apk', 'suivi_di_ds'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY "Lecture authentifiée %1$s"
        ON %1$s FOR SELECT
        USING (auth.role() = ''authenticated'');

       CREATE POLICY "Écriture assistant %1$s"
        ON %1$s FOR INSERT
        WITH CHECK (get_user_role() IN (''administrateur'', ''assistant''));

       CREATE POLICY "Modification assistant %1$s"
        ON %1$s FOR UPDATE
        USING (get_user_role() IN (''administrateur'', ''assistant''));

       CREATE POLICY "Suppression admin %1$s"
        ON %1$s FOR DELETE
        USING (get_user_role() = ''administrateur'');',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- POLITIQUES : référentiels (lecture tous, écriture admin)
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  refs TEXT[] := ARRAY[
    'ref_societes', 'ref_exploitations', 'ref_localisations',
    'ref_types_materiel', 'ref_marques', 'ref_operateurs',
    'ref_fonctions', 'ref_categories_probleme'
  ];
BEGIN
  FOREACH tbl IN ARRAY refs LOOP
    EXECUTE format(
      'CREATE POLICY "Lecture ref %1$s"
        ON %1$s FOR SELECT
        USING (auth.role() = ''authenticated'');

       CREATE POLICY "Admin gère ref %1$s"
        ON %1$s FOR ALL
        USING (get_user_role() = ''administrateur'')
        WITH CHECK (get_user_role() = ''administrateur'');',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- POLITIQUES : audit_logs
-- ============================================================
CREATE POLICY "Lecture audit admin"
  ON audit_logs FOR SELECT
  USING (get_user_role() = 'administrateur');

CREATE POLICY "Insertion audit authentifié"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
