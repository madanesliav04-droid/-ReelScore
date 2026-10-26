# Correctifs depuis socialplus-worker-errors-20261026

Base exacte : `0d9534311c4ebe78447a3b714a75b8d152893d97`. Travail isolé ; aucun déploiement, aucune fusion et aucun changement d’un moteur validé.

## Ce qui est corrigé

- Contrat Edge/worker : les alias historiques `clean`/`impact` rejoignent les implémentations existantes `creator_clean`/`business_viral`. Aucun des six modèles artistiques n’est remplacé par ces styles.
- Un modèle sans pipeline est refusé **avant création d’un job**. Alex retourne `ALEX_V16_SOURCE_REQUIRED` ; aucun crédit ni appel IA n’est déclenché par cette requête refusée.
- Imports Supabase/R2 : contrôle du nombre d’octets effectivement reçu, plafond de flux, vérification des morceaux, SHA-256 si fourni, suppression des fichiers partiels et délai réseau. Enregistrement Supabase : taille confrontée aux métadonnées de l’objet réellement stocké.
- Export : fichier non vide, H.264/AAC, nombre de pistes, dimensions et durée contrôlés avant publication du succès.
- Rotation iPhone : dimensions affichées calculées depuis la matrice de rotation ; pas de conversion portrait/horizontal arbitraire.
- Expiration de session pendant la reprise : retour à la connexion locale, identifiant du traitement conservé.
- Alex, V28 et Spatial sont visibles sans fausse disponibilité. UGC et les moteurs bêta existants restent conservés. Aucun CSS ni design refait.
- Dépendances worker verrouillées et installation Docker via `npm ci`.

## Sources Alex retrouvées — aucune nouvelle conception

Les quatre fichiers restaurés viennent de `editplus-alex-reference-lock-20261017`. Empreintes exactes dans `apps/worker/references/alex/sources.json` : directeur, rendu ASS, timing des beats et tokens graphiques. Leurs fonctions sont testées séparément, sans modifier les conditions de validation.

**Blocage V16 précis :** le pack disponible contient `EDITPLUS_HORMOZI_V16_B_PLEIN_ECRAN_V11_RESTAUREE.mp4`, `AUDIT_V16_RETOUR_V11.md` et `QA_V16.json`. L’audit décrit la réparation de 21 images de transitions de `EDITPLUS_HORMOZI_V11_B_HORIZONTAL(1).mp4`. Les graphismes, sous-titres, cuts et timings proviennent déjà de ce MP4 V11 ; ce traitement ne génère pas un montage à partir d’un rush brut.

Le module ASS retrouvé déclare lui-même une grammaire explicative avec texte en bande haute. Il exige alignement forcé vérifié et preuve indépendante de zone libre. Ce n’est pas la reproduction autonome des trois scènes plein écran de la V11/V16. Ni le candidat V8 ni le prototype Alex REF3 ne sont arbitrairement rebaptisés V16.

**Élément indispensable non retrouvé :** le code générateur et les ressources paramétrables des trois infographies plein écran de `EDITPLUS_HORMOZI_V11_B_HORIZONTAL(1).mp4`, permettant de remplacer paroles et timings sur un nouveau rush. Aucun nom de script n’est inventé. Un chemin Git/une archive de ce générateur suffirait ; renvoyer les mêmes MP4 ne résoudrait pas ce manque.

## Vérification et limites

Les tests navigateur sont des tests de contrat avec services explicitement interceptés ; ils ne prouvent pas un parcours Supabase/Railway réel. Le test du vrai rush mesure réellement transfert des octets, refus anonyme, intégrité, remux MP4, décodage et audio ; il n’ajoute aucun montage et **n’est pas présenté comme Alex**. Vidéo, son et fichiers de preuve personnels restent hors Git.

Commandes :

```sh
npm ci --prefix apps/worker
npm test --prefix apps/worker
npm ci --prefix viral-studio
npm run build --prefix viral-studio
# Chromium installé localement, ou navigateur Playwright déjà disponible :
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm test --prefix viral-studio
# Facultatif : diagnostic technique privé, jamais une validation artistique
SOCIALPLUS_TEST_RUSH=/chemin/prive/rush.mov node apps/worker/scripts/real-media-integrity.mjs
```

L’analyse non mise en cache du worker existant utilise Gemini. Aucun appel Gemini, envoi R2, abonnement ni ressource cloud n’a été activé par ces tests. Les 5 mots incertains du transcript vertical existant ne sont pas déclarés validés ; aucune nouvelle validation phonétique.

## Déploiement — état observé sans modification

Le connecteur Railway répond désormais en lecture seule. Le service `video-worker` observé utilise encore le déploiement `7fb6d620-ab30-4ee5-87ca-1116178f90a2` du 19 octobre. « Online » n’atteste ni consommation correcte de la file ni conformité V16. Aucun déploiement n’est déclenché ici et la production reste intacte.

Avant une recette distante : retrouver le générateur V11/V16, préparer un environnement de test autorisé avec authentification et stockage privés, vérifier ses variables Supabase et son coût, déployer les versions cohérentes frontend/Edge/worker, puis tester le rush réel jusqu’au téléchargement. Ne pas activer R2 ni un traitement IA facturé sans accord. Le parcours Alex complet sur iPhone reste non exécuté.

Résultats de cette branche : **59 tests worker réussis**, **19 tests navigateur de contrat réussis**, build Next.js réussi, syntaxe TypeScript Edge vérifiée. Sur le rush privé réellement transféré : 512 × 910, 27,167 s, H.264, une piste audio, décodage intégral et PCM identique après remux technique. Rapport : `artifacts/worker-errors-20261026/RESULTATS.json`. **Aucun rendu Alex V16, aucun parcours cloud complet et aucun Safari physique validés.**
