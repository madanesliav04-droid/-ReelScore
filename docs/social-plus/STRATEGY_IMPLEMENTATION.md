# Stratégie — lot V18 implémenté

Le module `apps/socialplus/server/strategy.mjs` fonctionne localement sans abonnement, sans clé IA et sans connexion prétendue à Instagram. Il conserve des données appartenant à l’utilisateur authentifié dans SQLite. Il n’altère pas l’infrastructure Supabase existante.

## Réemploi et traçabilité

Inspection des branches `socialplus-viral-v9-quality-gates-20261016`, `socialplus-viral-v6-live-20261016` et `viralplus-vf` le 22 octobre 2026 via l’API GitHub. Les branches v9/v6 contiennent le moteur multimodal distant et les gardes de vérification. Les fichiers conservés dans `server/legacy/` proviennent de v9 :

- `viral-personalization.js`, blob `fc1a9b3800ad4bd5f841eb3ea6a164694bb7c68c` : réemploi effectif de `reviewEditorialFixes` pour exclure corrections génériques, citations absentes, timecodes hors durée et B-roll sans justification.
- `viral-quality.js`, blob `40d6ad17b5cc232d421b356f831405a9b32188bd` : préservé pour traçabilité et futures intégrations. Ses poids V9 ne sont pas utilisés : ils ne satisfont pas le contrat de couverture conditionnelle V18.

Le module Gemini et ses appels payants ne sont pas activés. L’ancien upload vers un espace Supabase bêta ne constitue pas une preuve d’isolation et n’est pas réutilisé pour les fichiers privés.

## Fonctions réellement implémentées

- Profil créateur et objectif persistants.
- Saisie de mesures et calculs explicites : portée distincte des vues, champs manquants distincts de zéro, engagement seulement avec tous les composants, watch ratio supérieur à 100 % autorisé, attribution obligatoire pour conversion de profil/prospects.
- CSV UTF-8 avec BOM, séparateur virgule/point-virgule/tabulation, guillemets et retours ligne, accents et décimales FR. Aperçu obligatoire puis confirmation atomique. Réimport idempotent. Valeurs négatives, dates impossibles, doublons contradictoires et mapping ambigu rejetés.
- Douze fiches pédagogiques avec source, étapes, exercice, indicateurs et limites. Le propriétaire avec MFA peut publier des versions immuables et désactiver une méthode ; les anciens diagnostics gardent leur version et leur contenu.
- Diagnostic reproductible par snapshot/version/objectif, formule de priorité V18, maximum trois missions, étapes et suivi de réalisation. Moins de cinq contenus comparables conduit à une collecte de preuves, sans conclusion catégorique.
- Profils concurrents saisis manuellement avec source publique, date et notes. Aucun scraping.
- Comparaison de snapshots et rattachement d’une publication à une analyse historique. Incompatibilité plateforme/période/définition/format/durée => comparaison non évaluable. Les scores historiques ne sont pas réécrits.
- Analyse prépublication persistante avec SHA-256, contexte, version et timecodes. Les notes portent sur des observations éditoriales **renseignées par l’utilisateur**. Sans transcript fiable, les critères sémantiques sont exclus. Sans 60 % de couverture, le score global vaut `null`. Les métadonnées seules ne produisent aucune note narrative.
- Export et suppression de toutes les données Stratégie d’un utilisateur, y compris aperçus CSV. Aucun contenu d’un autre membre n’est exposé.

## Limites explicites

L’évaluation automatique multimodale ne s’exécute pas sans intégration autorisée. Le moteur local ne prétend pas comprendre seul le discours ni mesurer la rétention réelle depuis un fichier vidéo. Une note manuelle documentée n’est pas une certification par IA et ne prédit jamais les vues. La validation physique du fichier SHA-256 et le préflight FFprobe relèvent du pipeline d’import serveur.

Les sources pédagogiques sont celles de la spécification et des bibliothèques officielles. Le contenu reformule les démarches ; il ne reproduit aucun ouvrage ou support protégé intégralement. Les seuils et priorités sont des choix internes versionnés, pas des seuils des plateformes.

## Vérification exécutée

`node --test --test-isolation=none apps/socialplus/server/strategy.test.mjs`

31 tests réussis le 22 octobre 2026 après les corrections CSV, timezones, contradictions, méthodes versionnées et autorisations. Ils vérifient des calculs indépendants, la persistance SQLite, des requêtes API, l’isolation entre deux utilisateurs et les snapshots historiques. Ils ne remplacent pas les essais Safari physique ni la validation des moteurs vidéo.
