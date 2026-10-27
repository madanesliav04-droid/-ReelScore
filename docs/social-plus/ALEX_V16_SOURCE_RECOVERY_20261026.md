# Recherche du générateur Alex V11/V16 — 26 octobre 2026

## Résultat vérifié

Générateur original non retrouvé. Aucun moteur modifié, aucune reconstruction exécutée, aucun nouveau MP4 présenté comme Alex V16. Le master V16 est disponible en stockage privé ; une planche de contrôle à intervalles de 2 secondes a été inspectée. Il contient trois infographies plein écran, fond clair, traits fins bleutés et texte sombre. Les prototypes Alex navy/top-band ne constituent pas cette direction artistique.

## Périmètre de recherche

- Clone miroir complet : 91 branches, 1 321 commits, 7 570 objets accessibles. Récupération des références de toutes les PR accessibles : aucun commit supplémentaire.
- Recherche de noms et contenus historiques, y compris les versions de fichiers ensuite supprimées : 1 792 blobs texte examinés (jusqu’à 2,5 Mo, binaires exclus). Inventaire des 233 chemins de sources et archives ; scripts Python, JavaScript, JSX, TSX et HTML examinés sans dépendre de leur nom de modèle.
- Aucun tag distant. Les commits purgés de GitHub et inaccessibles par référence ne peuvent pas être inspectés.
- Ancien dépôt local : un commit orphelin de transcription et un cache Python identifiés ; aucun générateur des infographies V11.
- Autres dépôts accessibles : viral-plus-api (105 commits, 82 blobs texte), mypulse. (18 commits, 267 blobs texte), socialplus-ios-private-tests (2 commits, 7 blobs texte). Aucune correspondance du master ou des titres des infographies ; aucun code de MyPulse réutilisé.
- Dix archives locales inventoriées, dont neuf ZIP : exports, kit iOS, sources Cinematic et Leila. Aucun générateur Alex V11/V16. Le pack Alex extrait contient le master, README, index, audit et QA ; aucun script autonome.

## Sources retrouvées mais distinctes

- `apps/worker/src/hormozi-omni-director.js`, `hormozi-omni-render.js`, `hormozi-beat-timing.js`, `omni-brand-tokens.js` : grammaire ASS/top-band, déjà restaurée avec empreintes dans cette PR.
- `apps/worker/hyperframes/four-creators/full/ALEX_EXPLAIN/index.html`, `ALEX_REF3_NAVY_V2` à V5 et `ALEX_V6_PREMIUM_SCENES`, `ALEX_V7_APPLE_KINETIC` : prototypes historiques distincts, pas le générateur V11.
- `AUDIT_V16_RETOUR_V11.md` et `QA_V16.json` : correction de 21 images, six transitions d’une vidéo V11 déjà montée. Ils ne génèrent pas ses infographies.

## Fichiers réellement manquants

1. `EDITPLUS_HORMOZI_V11_B_HORIZONTAL(1).mp4` : original nommé dans l’audit, absent des fichiers accessibles. Non bloquant pour observer le design car le master V16 restauré est présent.
2. Source du générateur des trois infographies et ses ressources vectorielles/typographiques : **nom de fichier original inconnu**. Aucun `build_v16.py` ou autre nom de script ne peut être affirmé.
3. Plan source des scènes et animations : paramètres, instants d’entrée/sortie, courbes, raccords et association aux mots. **Nom de fichier original inconnu**. Aucun plan retrouvé n’est démontré comme celui de la V11.

Une liste de noms prétendument exacts pour les points 2 et 3 serait inventée. Les MP4 et audits ne permettent pas de retrouver le code originel.

## Proposition de reconstruction fidèle, distincte de l’original

À réaliser isolément, sous un statut explicite de reconstruction non validée, sans modifier le modèle verrouillé ni l’activer dans le sélecteur :

1. Relever image par image les entrées/sorties et positions du master présent. Trois compositions observées : « QUESTION ≠ RÉSULTAT » (deux cercles ? et +, flèche et appel « COMMENT AIDER ? »), « AIDER AVANT DE GAGNER » (cercles + et €, flèche, bandeau de conclusion), « CE QUE LES GENS PAIENT » (chaîne COMPÉTENCE → BESOIN → VALEUR et conclusion).
2. Réaliser trois composants paramétrables avec les technologies déjà présentes. Reproduire fond, géométrie, typographie, couleurs, entrées et raccords ; ne pas réutiliser les pixels ou la voix du master sur un nouveau rush. Police exacte et courbes d’animation restent à identifier, sans fausse garantie.
3. Vérifier d’abord une reproduction à texte et timings identiques au master, par images comparatives et séquences animées, puis validation humaine visuelle et sonore. Ces mesures doivent distinguer texte, positions, couleurs, transitions et synchronisation.
4. Adapter seulement ensuite au nouveau rush via transcription horodatée vérifiée, association explicite parole/graphique et conservation des dimensions/audio. Les mots incertains restent signalés. Ce nouveau moteur serait une reconstruction, jamais le code V16 retrouvé.

## Navigateur et Cloudflare

Le workflow Viral Studio CI 40363579694 a terminé avec succès : build Next et **19 tests navigateur en 28,4 secondes** sur Chromium, services interceptés. Aucun test Safari physique ni montage Alex distant n’est démontré.

Cloudflare : contrôle `Workers Builds: reelscore`, build `ffca36a0-526b-494b-9827-54828bab31aa`, échec sans annotation ni journal dans GitHub. Le dashboard renvoie une coquille HTML générique, pas les logs du build. Aucune connexion Cloudflare authentifiée disponible via les outils de cette session.

Vérification locale exécutée : `wrangler 4.153.0 deploy --dry-run --config cloudflare-worker/wrangler.jsonc`, succès, bundle 19,70 KiB (gzip 6,58 KiB), **aucun déploiement**. Le nom configuré est `viral-plus-api`, tandis que le contrôle vise `reelscore` : divergence confirmée, cause exacte non démontrée. Commande distante, répertoire racine, configuration et droits du build restent à lire dans ses logs. Aucune relance ou correction de production effectuée.

Le journal exact est accessible au propriétaire ici : https://dash.cloudflare.com/f5e096d6f4f167d1e1ac50fe2ed76b63/workers/services/view/reelscore/production/builds/ffca36a0-526b-494b-9827-54828bab31aa

## Publication

Rapport local et résultats ajoutés à la description de la PR #58. Aucun nouveau push de code afin de ne pas redéclencher l’intégration Cloudflare ciblant `production` avant clarification. Aucune fusion, aucun média privé publié.
