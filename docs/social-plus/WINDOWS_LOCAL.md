# Lancer Social+ localement sur Windows

Cette branche fournit une application web locale avec stockage SQLite et rendus FFmpeg locaux. Elle ne déploie rien, ne modifie aucun service existant et n'active aucun paiement. Les six références artistiques sont visibles avec leurs indisponibilités réelles ; l'export technique MP4 est une fonction distincte.

## Prérequis

- Windows 10/11, PowerShell et Git.
- Node.js 24 ou plus récent, avec npm.
- FFmpeg et FFprobe dans le `PATH` pour l'import et l'export vidéo. Utiliser une distribution Windows dont la provenance et la licence ont été vérifiées.
- Une application d'authentification TOTP sur votre téléphone pour le propriétaire.

```powershell
git clone --branch codex/socialplus-v18-implementation-20261022 https://github.com/madanesliav04-droid/-ReelScore.git
Set-Location .\-ReelScore\apps\socialplus
node --version
ffmpeg -version
ffprobe -version
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run owner
npm start
```

Ouvrir `http://localhost:4318` dans Chrome ou Edge. `npm ci` installe les dépendances verrouillées du compositeur Social Kinetic hors ligne (Playwright et GSAP). Les autres traitements utilisent Node.js, Python et FFmpeg. Si le port est occupé, changer ensemble `PORT` et `SOCIALPLUS_ORIGIN` dans `.env.local` avant de relancer.

`npm run owner` demande l'adresse e-mail vérifiée, inscrit le propriétaire dans la base locale, affiche une clé TOTP dans votre terminal privé et exige le code correspondant. Le mot de passe est saisi sans écho. Garder `.env.local` et `.data` hors Git. Ne jamais partager une capture contenant la clé ou le QR/URI TOTP. Une connexion propriétaire exige mot de passe et nouveau code MFA.

## Parcours de vérification

1. Depuis le profil, ouvrir l'administration puis créer une invitation ciblée 7 jours, 30 jours ou permanente. Vérifier personnellement l'adresse et transmettre le code par un canal privé. Aucun e-mail n'est envoyé automatiquement.
2. Activer l'invitation dans une autre session de navigateur. Vérifier que le membre n'accède pas à `/admin` et ne voit pas les projets du propriétaire.
3. Créer un projet dans Montage, importer un rush dont vous avez les droits et lire l'aperçu réel. Le préflight signale les formats non pris en charge. L'export technique produit un MP4 H.264/AAC ; il ne prétend pas reproduire l'un des six modèles.
4. Dans Stratégie, enregistrer le profil, saisir des données ou importer un CSV avec aperçu puis confirmation. Les chiffres absents restent indisponibles. Les diagnostics et missions sont calculés depuis ces seules données.
5. Depuis le compte, envoyer un avis privé, consulter la FAQ, exporter ses données et tester la suppression avec un compte de test. La suppression confirmée est irréversible dans cette base locale.

Les paramètres juridiques de `.env.local` sont volontairement vides. Les pages restent indiquées comme brouillons tant que l'identité réelle, le contact, l'hébergement et la revue du propriétaire ne sont pas renseignés. Compléter ces informations avant toute ouverture aux équipes.

## Tests

```powershell
npm test
Set-Location ..\..
node --test --test-isolation=none --test-reporter=spec apps/worker/tests/hormozi-beat-timing.test.mjs apps/worker/tests/hormozi-omni-director.test.mjs apps/worker/tests/hormozi-source-format.test.mjs apps/worker/tests/social-kinetic-v28-integration.test.mjs
node apps/socialplus/scripts/verify-render.mjs
```

Les fichiers `artifacts/render/*` sont des essais techniques synthétiques identifiés, sans parole réelle. Ils ne remplacent pas la recette artistique sur trois nouveaux rushs par modèle. Consulter `V18_ACCEPTANCE_REPORT.json` pour les 97 scénarios et `ENGINE_IMPLEMENTATION.md` pour les sources absentes.

## iPhone et sauvegarde

Le serveur écoute volontairement la boucle locale. `localhost` sur l'iPhone désigne l'iPhone, pas le PC. Pour une vraie recette Safari iPhone, prévoir un staging privé HTTPS autorisé ou un accès HTTPS local correctement configuré ; ne pas exposer directement le serveur sur Internet. Aucun hébergement ni tunnel payant n'est activé par ces instructions. Les captures aux dimensions iPhone exécutées sous Chromium sont de l'émulation, pas un essai Safari matériel.

Arrêter le serveur avec `Ctrl+C` avant de sauvegarder ensemble `.data` et `.env.local` dans un emplacement privé. Pour revenir à une sauvegarde, arrêter le serveur, conserver une copie de l'état courant, puis restaurer les deux éléments cohérents. La restauration et les délais de conservation doivent faire l'objet d'une recette avant production. La production existante Supabase/Railway/Cloudflare n'est pas migrée par cette branche.

Pour les six adaptations de modèles : installer Python 3, puis `python -m pip install numpy Pillow`. Dans `.env.local`, définir `SOCIALPLUS_PYTHON=python`. Pour Social Kinetic, renseigner `SOCIALPLUS_CHROMIUM` avec le chemin de Chrome/Chromium déjà installé, par exemple `C:\Program Files\Google\Chrome\Application\chrome.exe`. Aucun appel à un service de rendu externe n’est effectué. `npm run preflight` contrôle les prérequis.

## Transcription locale facultative

Pour remplir les mots horodatés depuis un vrai rush, installer le module local :

```powershell
python -m pip install -r engines/requirements-asr.txt
```

Placer un modèle **faster-whisper** compatible déjà téléchargé dans un dossier privé (au minimum `model.bin`, `config.json`, `tokenizer.json`). Renseigner `SOCIALPLUS_ASR_MODEL_DIR` avec ce dossier et `SOCIALPLUS_ASR_PYTHON=python` dans `.env.local`, puis redémarrer. Le bouton « Transcrire localement » apparaît actif dans Montage. Le traitement utilise le CPU ; son temps dépend du PC. Aucune clé API, synthèse vocale ou connexion aux réseaux sociaux n'est requise. Le moteur interdit les téléchargements à l'exécution.

Relire les mots en écoutant la source. Les horaires Whisper sont automatiques et approximatifs : la case de validation reste décochée. Le mode « transcription encore à relire » permet un MP4 de prévisualisation explicitement non validé. Les événements graphiques désignent les indices des mots de ce rush ; ne jamais recopier les timings des masters. Alex propose aussi `kind: "fullscreen"`, avec un second groupe facultatif `secondaryWordIndex` / `secondaryWordCount`. Utiliser ce mode quand la bande haute cacherait le visage. Codie accepte `events: []` si aucun mot « temps » ou « argent » n'est prononcé.

Les nouvelles coupes restent dans les pauses acoustiques mesurées et, avec une transcription, conservent 120 ms de marge autour des mots. Une transcription imprécise nécessite une revue supplémentaire des raccords. Les six adaptations restent en bêta jusqu'à validation artistique et phonétique ; elles ne rejouent ni la voix ni les pixels des masters.
