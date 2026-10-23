# Recherche d’un rush existant — 23 octobre 2026

La recherche a identifié deux fichiers vidéo source déjà enregistrés dans le stockage du projet. Leur contenu n’a pas pu être lu : aucun test de parole ni rendu des six modèles sur ces fichiers n’a été effectué. Aucune nouvelle transmission des fichiers n’est demandée. Le développement indépendant des médias peut continuer.

## Sources examinées

- Inventaire local, y compris fichiers cachés : `/workspace/library-files`, `/workspace/scratch`, `/workspace/shared/downloads`, `/home/agent`, `/mnt`, `/media`, `/srv` et `/var/tmp`. Avant récupération du code, aucun média ou archive utilisateur n’était présent. Les fichiers audio de bibliothèques système ne constituent pas des rushs du projet.
- Dépôt `madanesliav04-droid/viral-plus-api` : code et configuration, sans média ni archive utilisateur ; référence au bucket privé `viralplus-videos`.
- Dépôt public `madanesliav04-droid/-ReelScore` : 77 arbres de références distantes inspectés sans téléchargement des médias. Aucun rush brut ni archive média trouvé dans ces arbres. Les seuls MP4 versionnés sont des fixtures et des exports techniques synthétiques, explicitement sans parole réelle. Aucune release ni aucun tag trouvé lors de cette recherche. L’historique complet de chaque branche n’a pas été exploré.
- Branche de référence `codex/socialplus-v18-implementation-20261022` : scripts, manifestes et README des six modèles reçus le 23 octobre. Ils citent les anciens rushs `IMG_0506.mp4`, `IMG_0506(2).mp4` et `IMG_0516.mp4`, ainsi que des archives source, mais sans fichier physique ni identifiant téléchargeable dans les arbres inspectés. La mention « ChatGPT Library » ne permet pas de conclure que ces archives sont montées dans cet environnement.
- Supabase, en lecture seule : métadonnées du bucket `viralplus-videos`, politiques de `storage.objects` et recherche de liens dans `edit_projects.settings`, `edit_jobs.payload`, `edit_jobs.result` et `edit_timelines.timeline_json`. Aucun lien Storage signé persistant trouvé dans ces champs ; les liens présents concernent des images B-roll et leurs licences.

## Candidats déjà stockés

| Fichier | Taille exacte | Type déclaré | Enregistrement |
| --- | ---: | --- | --- |
| `IMG_0333.mov` | 6 523 790 octets | `video/quicktime` | 18 octobre 2026 |
| `IMG_0332.mov` | 26 149 341 octets | `video/quicktime` | 18 octobre 2026 |

`IMG_0333.mov` est le candidat prioritaire en raison de sa taille. Ces métadonnées prouvent l’existence d’objets enregistrés, mais pas leur disponibilité actuelle au téléchargement, leur caractère brut ou la présence d’une voix. Aucun UUID de compte, chemin utilisateur complet ou jeton d’accès n’est reproduit ici.

## Deux limites d’accès distinctes

1. **Restriction de service constatée.** Une requête GET Storage utilisant la clé publique déjà configurée et une plage maximale de 1 024 octets sur `IMG_0333.mov` a répondu **HTTP 402** avec le code de restriction `exceed_storage_size_quota`. Aucun octet vidéo n’a été reçu. Le service signale un quota de stockage dépassé ; aucun plan, plafond de dépense ou paramètre du fournisseur n’a été modifié.
2. **Authentification requise par la politique existante.** Le bucket est privé. La politique SELECT de `storage.objects` s’applique au rôle `authenticated` et exige que le premier dossier corresponde à `auth.uid()`. La clé publique seule ne constitue pas une session du propriétaire. La résolution de la restriction de quota ne fournirait donc pas, à elle seule, l’accès authentifié nécessaire. L’autorisation finale n’a pas pu être testée, la requête étant arrêtée par le HTTP 402.

Aucune politique d’accès, fonction distante, migration ou passerelle de contournement n’a été créée. Aucun mot de passe, secret de service ou contenu de session Auth n’a été recherché.

## État des tests et consommation

- Aucun fichier candidat téléchargé ni écouté ; aucune transcription produite.
- Aucun test de parole ni comparaison visuelle des six modèles sur un rush réel effectué.
- Zéro appel de modèle ou de génération ; aucun service facturé lancé par cette recherche.
- Les six exports synthétiques préexistants attestent seulement les vérifications techniques décrites dans leurs rapports. Ils ne valident ni les mots prononcés, ni leur synchronisation, ni la fidélité artistique sur un nouveau rush.
- Les requêtes distantes sont arrêtées après constat des limites, pour éviter les tentatives inutiles et préserver le quota.

## Reprise locale

Le travail peut reprendre à partir d’un fichier déjà disponible localement ou récupéré par un accès média autorisé lorsque le service le permet, sans demander de renvoyer les fichiers existants. Conserver le rush hors du dépôt et préserver les sources historiques sans modification.

Avant les six rendus, vérifier localement le conteneur, la durée, l’orientation, la piste audio et la présence d’une parole exploitable. Calculer une empreinte SHA-256 pour réutiliser le même extrait et les résultats en cache. Choisir un court extrait représentatif et conserver une seule préparation audio/transcription réutilisable. La transcription alignée et les placements doivent être relus ; ne pas inventer les mots ou reprendre ceux des références historiques.

Les six adaptations actuelles acceptent au maximum 60 secondes et du 1080p natif. Utiliser le banc d’essai local et son mode de préparation sans rendu avant toute exécution, puis reprendre les rendus manquants à partir du cache au lieu de relancer les sorties déjà vérifiées. Les fonctionnalités qui ne nécessitent pas de rush restent indépendantes de cette recette audiovisuelle.
