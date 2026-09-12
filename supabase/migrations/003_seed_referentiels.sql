-- ============================================================
-- MIGRATION 003 — DONNÉES DE RÉFÉRENCE INITIALES
-- ============================================================

-- Sociétés
INSERT INTO ref_societes (valeur, ordre) VALUES
  ('Société A', 1),
  ('Société B', 2),
  ('Société C', 3)
ON CONFLICT (valeur) DO NOTHING;

-- Exploitations
INSERT INTO ref_exploitations (valeur, ordre) VALUES
  ('Abidjan',    1),
  ('Daloa',      2),
  ('Bouaké',     3),
  ('San Pedro',  4),
  ('Yamoussoukro', 5),
  ('Man',        6),
  ('Korhogo',    7),
  ('Siège',      8)
ON CONFLICT (valeur) DO NOTHING;

-- Localisations
INSERT INTO ref_localisations (valeur, ordre) VALUES
  ('Bureau direction',  1),
  ('Salle informatique', 2),
  ('Open space',        3),
  ('Dépôt',             4),
  ('Terrain',           5)
ON CONFLICT (valeur) DO NOTHING;

-- Types de matériel
INSERT INTO ref_types_materiel (valeur, ordre) VALUES
  ('Ordinateur de bureau',     1),
  ('Ordinateur portable',      2),
  ('Imprimante simple',        3),
  ('Imprimante MFP',           4),
  ('Scanner',                  5),
  ('Routeur',                  6),
  ('Switch',                   7),
  ('Téléphone',                8),
  ('Tablette',                 9),
  ('TSP',                      10),
  ('Onduleur',                 11),
  ('Régulateur / Stabilisateur', 12),
  ('Borne Wi-Fi',              13),
  ('Autre',                    14)
ON CONFLICT (valeur) DO NOTHING;

-- Marques
INSERT INTO ref_marques (valeur, ordre) VALUES
  ('Dell',        1),
  ('HP',          2),
  ('Lenovo',      3),
  ('Apple',       4),
  ('Asus',        5),
  ('Acer',        6),
  ('Samsung',     7),
  ('Cisco',       8),
  ('TP-Link',     9),
  ('Epson',      10),
  ('Canon',      11),
  ('APC',        12),
  ('Eaton',      13),
  ('Autre',      99)
ON CONFLICT (valeur) DO NOTHING;

-- Opérateurs
INSERT INTO ref_operateurs (valeur, ordre) VALUES
  ('Orange',     1),
  ('MTN',        2),
  ('Moov',       3),
  ('Wave',       4),
  ('Autre',      9)
ON CONFLICT (valeur) DO NOTHING;

-- Fonctions de poste
INSERT INTO ref_fonctions (valeur, ordre) VALUES
  ('Poste de travail standard',  1),
  ('Poste de direction',         2),
  ('Poste comptable',            3),
  ('Poste RH',                   4),
  ('Poste technique',            5),
  ('Serveur',                    6),
  ('Poste mobile',               7),
  ('Autre',                      9)
ON CONFLICT (valeur) DO NOTHING;

-- Catégories de problèmes
INSERT INTO ref_categories_probleme (valeur, ordre) VALUES
  ('Réseau',          1),
  ('Imprimante',      2),
  ('Windows',         3),
  ('Office',          4),
  ('Messagerie',      5),
  ('Logiciel métier', 6),
  ('Matériel',        7),
  ('Téléphonie',      8),
  ('Sécurité',        9),
  ('Autre',          99)
ON CONFLICT (valeur) DO NOTHING;
