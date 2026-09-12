# Guide Administrateur — Le Labo de l'Assistant

## Connexion initiale

1. Aller sur l'URL de l'application
2. Saisir l'email et le mot de passe
3. Le tableau de bord s'affiche après authentification

## Créer le premier administrateur

Dans Supabase > Authentication > Users, créer un utilisateur puis dans SQL Editor :

```sql
UPDATE app_users
SET role = 'administrateur'
WHERE email = 'votre@email.com';
```

## Gestion des utilisateurs (Admin > Utilisateurs)

### Créer un utilisateur

1. Cliquer **Nouvel utilisateur**
2. Saisir email, nom complet, rôle, mot de passe initial
3. L'utilisateur peut se connecter immédiatement

### Rôles disponibles

- **Administrateur** : accès complet
- **Assistant** : création + modification, pas d'accès admin
- **Consultation** : lecture seule

### Désactiver / réactiver

Cliquer l'icône désactiver (🚫) ou réactiver (↩️) sur la ligne utilisateur.

## Gestion des référentiels (Admin > Référentiels)

Les référentiels évitent la saisie libre et les doublons.

**Référentiels disponibles :**
- Sociétés
- Exploitations
- Localisations
- Types de matériel
- Marques
- Opérateurs télécom
- Fonctions de poste
- Catégories de problèmes

### Ajouter une valeur

1. Sélectionner le référentiel dans le menu de gauche
2. Cliquer **Ajouter**
3. Saisir la valeur, une description optionnelle, un ordre d'affichage
4. Valider

### Désactiver une valeur

Cliquer l'icône de bascule (toggle). La valeur n'apparaît plus dans les listes mais les données existantes sont conservées.

## Journal d'audit (Admin > Journal d'audit)

Toutes les créations, modifications et désactivations sont journalisées.

**Informations disponibles :**
- Date et heure exacte
- Type d'action (CREATION, MODIFICATION, DESACTIVATION, REACTIVATION)
- Table concernée
- ID de l'enregistrement
- Utilisateur auteur
- Valeurs avant / après modification

**Filtres :**
- Par table (inventaire, tsp, campagnes…)
- Par action
- Par ID d'enregistrement

## Désactivation d'un matériel

La suppression physique des matériels est interdite par conception.

Procédure :
1. Ouvrir la fiche matériel
2. Cliquer **Désactiver**
3. Sélectionner un motif
4. Saisir une observation (obligatoire)
5. Confirmer

Le matériel disparaît de l'inventaire actif mais reste accessible via **Inventaire > Archives**.

### Réactiver un matériel

1. Aller dans **Inventaire > Archives**
2. Trouver le matériel
3. Cliquer l'icône réactiver
4. Son état passe à "En stock"

## Campagnes de migration

Créer une campagne :
1. Aller dans **Campagnes**
2. Cliquer **Nouvelle campagne**
3. Saisir le nom, le type, les dates, le statut initial
4. Cliquer sur la campagne pour accéder au suivi
5. Ajouter les équipements concernés un à un ou par import

Aucune modification du schéma SQL n'est nécessaire pour créer une nouvelle campagne.

## Export des données

Chaque module dispose de boutons d'export :
- **Excel (XLSX)** — avec mise en forme
- **CSV** — universel
- **PDF** — pour impression

Le module **États & Rapports** centralise 17 rapports prédéfinis.

## Sauvegarde

Supabase effectue des sauvegardes automatiques.

Export manuel recommandé depuis chaque module régulièrement.

Procédure de sauvegarde SQL :
1. Supabase Dashboard > Project Settings > Backups
2. Ou depuis SQL Editor : `SELECT * FROM inventaire;` puis exporter

## Politique de mots de passe

Longueur minimale recommandée : 12 caractères.
Rotation recommandée : tous les 90 jours.

## En cas de problème

- Vérifier les logs dans **Admin > Journal d'audit**
- Vérifier les logs Supabase (Dashboard > Logs)
- Vérifier la console navigateur (F12)
