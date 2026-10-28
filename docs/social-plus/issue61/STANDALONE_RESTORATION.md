# Restauration du serveur existant — 28/10/2026

Le backend autonome a été retrouvé dans `/workspace/ReelScore/apps/socialplus`,
branche `codex/oracle-arm64-free-preparation-20261025`. Il n’a pas été réécrit :
200 fichiers source/ressource/test sont réintégrés, dont 194 fichiers d’origine.
Source Git distante : `4da180b2b1a2f33c44cdca3796438c15da57f413` ; cinq dépendances
worker ont été récupérées dans le checkout local existant
`fa391d10ba9f3d0582978fcb1374d6f4a483c48e`. Aucun rush, master ou résultat privé
n’est inclus. Les polices restaurées conservent leur manifeste/licence OFL.

## Ce qui est réutilisé

- Serveur Node 24, base SQLite, comptes/invitations et accès limités, sessions
  HttpOnly/Secure, CSRF, MFA propriétaire, administration, FAQ et avis privés.
- Projets, véritables uploads, stockage privé local, queue, progression,
  reprise après redémarrage, lecture Range et téléchargement authentifié.
- Analyse FFmpeg, transcription Whisper hors ligne et repères éditoriaux locaux
  liés aux mots/timestamps ; aucune clé Supabase, Gemini ou R2 nécessaire.
- Sources et capture V28 verrouillées, assets et scripts des six références.

## Corrections de raccordement, sans toucher aux moteurs verrouillés

- Restauration de six dépendances worker absentes, sans écraser les fichiers
  déjà présents. L’API historique `buildCaptionAss`, importée par le serveur
  restauré, est réexportée depuis une copie verbatim de l’ancien helper :
  aucun pipeline actuel n’est redirigé vers un preset historique.
- Admission runtime séparée : V28 reste raccordée ; les quatre autres moteurs
  non raccordés et Alex par défaut sont indiqués indisponibles. Les anciens alias
  `restored-preview:` ne contournent pas cette vérification, effectuée avant mise
  en queue. Les sources sont conservées, pas remplacées par un rendu générique.
- Alex peut être activé explicitement pour contrôle avec les trois flags du
  `.env.example`. Il utilise alors **le même `renderAlexV16` que le worker actuel**,
  pas l’ancien overlay. Les corrections de mots transmises sont conservées, liées
  au SHA du rush calculé côté serveur et validées par le moteur. La case humaine
  n’est pas cochée automatiquement. Les JSON temporaires sont supprimés ; les
  pauses manuelles non raccordées sont refusées explicitement, pas ignorées.
- `/healthz` reste une vérification de vie ; `/readyz` distingue SQLite, compte
  propriétaire/MFA provisionné, configuration HTTPS/cookies, FFmpeg/ffprobe,
  Chromium, ASR configuré et intégrité V28. Ce n’est pas une certification de
  fidélité, de précision phonétique ou de certificat TLS public.
- Entrée Next.js `/studio` : redirection vers une **origine HTTPS vérifiée** si
  `SOCIALPLUS_STANDALONE_ORIGIN` et `SOCIALPLUS_STANDALONE_VERIFIED=true` sont
  configurés côté serveur. Aucun query string, jeton Vercel ou mot de passe n’est
  transmis. Sinon, un état indisponible explicite s’affiche. L’app complète reste
  sur une origine unique pour les cookies Safari et les uploads volumineux ; les
  vidéos ne sont pas relayées à travers une Function Vercel limitée en taille.

## Tests réellement exécutés

- Suite autonome restaurée : **140 tests réussis**, puis test supplémentaire de
  conservation des corrections/transcription et suppression des temporaires réussi.
  La suite complète finale est aussi préparée dans la CI isolée.
- Worker actuel : **80 tests réussis** après ajout de la compatibilité.
- Entrée Next.js : **2 tests réussis**, build Next.js/TypeScript réussi.
- `assertKineticRelease()` : empreintes verrouillées intactes.
- **V28, vrai rush parlé** : connexion propriétaire/MFA sur HTTPS local isolé,
  import via navigateur tactile, analyse et ASR hors ligne, préparation de la
  direction approuvée, queue réelle, rendu, lecture du MP4, téléchargement avec
  contrôle de hash, Range 206, invité refusé 401, redémarrage et réouverture.
  Le MP4 décodé complet et le PCM original sont vérifiés ; l’empreinte de sortie
  correspond exactement à la sortie approuvée dans le verrou V28. Dernier essai
  environ 49,7 secondes, incluant préparation/ASR, sur ce Linux local uniquement.
- **Alex, vrai rush parlé** : connexion/import/préparation/rendu via le moteur
  partagé/lecture/téléchargement et récupération après redémarrage réussis. Aucun
  master en entrée, décodage complet du MP4 réussi. Transcription toujours marquée
  à vérifier ; fidélité artistique finale non déclarée validée par ce test.
- **Analyse, vrai rush parlé** : import et formulaire UI réels, mesures FFmpeg,
  ASR réel, repères horodatés ; deux imports indépendants donnent les mêmes critères,
  constats et `inputHash`. Aucun score éditorial global ni rétention inventé :
  ce moteur local fournit des indices acoustiques/lexicaux, pas une compréhension
  sémantique complète. Les citations ASR restent provisoires tant qu’elles ne sont
  pas relues.

Ces essais utilisent un certificat auto-signé accepté **uniquement dans le
contexte de test local**. Aucun iPhone physique, serveur public ou Oracle ARM64
n’a été testé par ces essais. Aucun appel payant effectué. Les MP4, captures et
rapports détaillés restent dans les dossiers privés
`/workspace/socialplus-private-renders/standalone-*-e2e-20261028*`.

Scripts reproductibles : `apps/socialplus/scripts/kinetic-ui-smoke.mjs`,
`alex-ui-smoke.mjs`, `editorial-ui-smoke.mjs`. Ils exigent explicitement le rush
privé et les poids locaux ; ne jamais lancer ces médias dans un job/artefact public.

## Blocages qui restent

Le backend complet n’est **pas hébergé**. Les seules ressources Railway accessibles
sont en production. Aucune instance Oracle isolée n’est accessible à la tâche et
le propriétaire ne sait pas encore s’il possède un compte. Aucun service n’a été
créé, aucun quota ou tarif modifié. Le Docker/pack Oracle préexistant est conservé,
mais la capacité gratuite, la compatibilité native et HTTPS restent à vérifier
avant activation.

La Preview Vercel actuelle reste un frontend avec contrôle technique sur l’appareil,
pas ce serveur FFmpeg/SQLite. Son URL ne doit pas être présentée comme un studio
cloud complet. Pour poursuivre : vérifier d’abord l’accès du propriétaire à
https://cloud.oracle.com/ ; ne créer aucune VM ni activer de mise à niveau à ce stade.

Les cinq autres signatures ne deviennent pas automatiquement autonomes parce que
leurs sources sont restaurées. Quatre restent bloquées par défaut ; Alex demeure
une activation explicite de QA. La V28 exige toujours une direction contextuelle
revue : le test sur son rush approuvé ne certifie pas tous les nouveaux discours.

## Validation CI finale et paquet de lancement

Le workflow isolé [40724306763](https://github.com/madanesliav04-droid/-ReelScore/actions/runs/40724306763), commit `87eb257332f0a1725ea2b1495e993687bbad8863`, est réussi : tests du worker, serveur autonome, frontend et build Next.js. Les trois échecs Python initiaux provenaient de NumPy absent du runner ; les dépendances existantes ont été installées sans retirer de tests.

Les trois Dockerfiles incluent désormais le verrou npm du worker, ses dépendances de production, les compositions Remotion et les scripts/ressources Alex. Ces copies sont nécessaires aux imports statiques du serveur restauré. Cette correction de packaging n'est pas une validation du build Docker ni d'un rendu ARM64 natif : ils restent à exécuter sur une machine autorisée. Aucun moteur artistique verrouillé n'a été modifié.
