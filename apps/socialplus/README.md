# Social+ V18 — application privée locale

Accueil, Montage et Stratégie utilisent une base SQLite persistante et des fichiers privés locaux. Le propriétaire se provisionne dans le terminal avec MFA. Le quota de calcul est limité par défaut à 10 traitements par membre et jour UTC (`SOCIALPLUS_MAX_RENDERS_PER_DAY`). Supprimer un projet ne remet pas ce compteur à zéro. Aucun compte de démonstration n’est activé au lancement et aucun service externe facturé n’est appelé.

Avec Node.js 24, FFmpeg et FFprobe installés :

```sh
cd apps/socialplus
npm ci
npm run owner
npm start
```

Ouvrir `http://localhost:4318`. Le script propriétaire initialise `.env.local` sans remplacer les paramètres existants. Les invitations sont transmises manuellement après vérification personnelle du destinataire. Les pages juridiques restent des brouillons tant que l’identité et le contexte réels ne sont pas renseignés.

```sh
npm test
```

Le serveur de base utilise les modules Node.js. Les tests et le rendu Social Kinetic exigent les dépendances verrouillées installées par `npm ci`. Le script facultatif `scripts/browser-smoke.mjs` exige Playwright Core et Chromium déjà installés ; il peut utiliser `PLAYWRIGHT_MODULE_PATH` et `CHROMIUM_PATH`. Il crée uniquement une base temporaire et une vidéo technique générée, puis supprime les comptes de test. Il ne déploie rien.

- [Installation Windows + iPhone : guide débutant](../../docs/social-plus/WINDOWS_IPHONE.md)
- [Rapport des 97 scénarios](../../docs/social-plus/V18_ACCEPTANCE_REPORT.json)
- [Sources indispensables manquantes](../../docs/social-plus/MISSING_SOURCES.md)
- [Moteurs réemployés et vrais essais FFmpeg](../../docs/social-plus/ENGINE_IMPLEMENTATION.md)
- [Sécurité et limites du fonctionnement local](../../docs/social-plus/SECURITY_LOCAL.md)

Les six références artistiques sont préservées avec leurs statuts réels. Leur rendu autonome n’est pas certifié. L’export technique H.264/AAC est opérationnel et clairement distinct de ces modèles. Les scores de préparation éditoriale utilisent uniquement des observations documentées ; aucune analyse sémantique automatique ou prédiction de viralité n’est simulée.

### Montage local et mesures du fichier

Enregistrer un rush dans Montage, puis **Analyser mon rush**. Après écoute, cocher les pauses à raccourcir et lancer **Créer mon montage MP4**. Les coupes vidéo/audio partagent la même table temporelle. Les mots alignés JSON fournis peuvent être incrustés après confirmation de leur synchronisation ; aucune transcription n’est inventée. Le renderer de sous-titres et la conversion des temps réutilisent le worker existant. Ce montage assisté reste distinct des six modèles artistiques dont les sources ou la recette manquent.

Dans Stratégie → Analyser une vidéo, sélectionner un projet enregistré puis **Analyser le fichier réel** : niveau moyen/pic, pauses mesurées et recommandations acoustiques déterministes, avec empreinte SHA-256 et version du moteur. Le résultat est conservé par source et isolé par membre. Modifier le rush invalide cette analyse. Une nouvelle analyse consomme un traitement du quota journalier ; relire le résultat en cache ne consomme rien. Ces signaux ne produisent aucun faux score éditorial ou de viralité.

### Préparation d’un hébergement privé

`npm run preflight` vérifie Node 24, SQLite, FFprobe, H.264/AAC et libass sans déployer. Les fichiers Docker/Compose fournis préparent une instance séparée ; ne pas les appliquer à la production existante. L’image se construit depuis la racine du dépôt et n’inclut ni `.env.local`, ni vidéos, ni identifiants.

Sur une machine et un hébergement autorisés : configurer `.env.local` avec l’origine HTTPS exacte et les paramètres propriétaires privés, puis `docker compose build`. Provisionner le propriétaire dans le volume persistant avec `docker compose run --rm socialplus node scripts/provision-owner.mjs` (terminal privé), vérifier `docker compose run --rm socialplus npm run preflight`, puis démarrer seulement après autorisation avec `docker compose up -d`. Le port est limité à la boucle locale derrière un proxy HTTPS existant ; les sessions sécurisées exigent cette origine HTTPS. Sauvegarder le volume avant toute mise à jour et conserver les secrets séparément. Aucun de ces déploiements n’est déclenché par le code.


### Sources originales restaurées

Les scripts du pack léger utilisateur sont conservés sans modification dans `engines/originals`, avec empreintes SHA-256. Trois ports de composants sont accessibles depuis le modèle choisi : icônes Codie V60, titres muraux Leila et titres Spatial V10. Ils utilisent les fonctions de dessin originales, vos mots alignés et vos zones libres validées. Le formulaire d’événements désigne les mots par `wordIndex` (à partir de zéro) et `wordCount`, puis leur rectangle normalisé. Aucune date historique, phrase de référence ni piste audio d’un autre rush n’est appliquée.

Python 3 avec `numpy` et `Pillow` est requis pour ces essais (`python -m pip install numpy Pillow`). Configurer `SOCIALPLUS_PYTHON=python` sur Windows si nécessaire. Les essais gardent le format natif jusqu’à 720p et 60 secondes, et exportent H.264/AAC. Ils ne constituent pas encore les moteurs complets certifiés V60/V53/V10. Le script Cinematic V7 est bien restauré, mais ses scènes utilisent les vidéos V6 et le rush absents du pack léger : elles restent bloquées, sans remplacement artificiel.


### Six adaptations de modèles — références reçues le 23 octobre

Les six vidéos de référence sont reçues et vérifiées. Elles restent hors du dépôt standard ; `engines/REFERENCE_MANIFEST.json` conserve leurs empreintes et distingue les copies recompressées de transport. Les fichiers `originals/received-20261023` complètent les sources sans modifier celles déjà intégrées.

Les six modèles disposent désormais d’une adaptation en bêta, avec texte déclenché par les mots fournis et placement relu. Alex réutilise le renderer ASS OMNI ; Social Kinetic réutilise son compositeur HTML/GSAP V28, capturé localement et sans CDN ; Cinematic reprend les fonctions graphiques Python de la chaîne V6/V7 pour des séquences plein écran, en masquant les sous-titres pendant ces séquences. Aucun texte, cut ni audio de référence n’est appliqué à une autre vidéo. Les coupes de pauses validées peuvent précéder les six rendus ; leurs mots et déclencheurs sont recalés sur le même montage.

Lancer `npm ci` pour les deux dépendances verrouillées Playwright/GSAP. Python avec numpy/Pillow et Chrome/Chromium local sont nécessaires ; consulter le guide Windows. Les rendus d’essai restent limités à 1080p natif et 60 secondes. La fidélité artistique et l’écoute mot-à-mot nécessitent une recette sur de nouveaux rushs parlés : `releaseApproved` reste faux. Les sous-titres reposent sur la transcription alignée fournie et relue, sans transcription automatique simulée.

### Prévisualisation Montage / Analyse (24 octobre)

Les deux espaces principaux sont **Montage** et **Analyse**. Les pages du profil, FAQ, avis et confidentialité sont conservées. Dans Montage : importer et enregistrer un rush, choisir un modèle, utiliser **Préparer automatiquement ce modèle**, vérifier les zones graphiques puis lancer la prévisualisation. Le moteur local Whisper doit être configuré (`SOCIALPLUS_ASR_MODULE_DIR` et `SOCIALPLUS_ASR_MODEL_DIR`) ; il ne télécharge pas de modèle et n’appelle aucun service payant. Les six adaptations sont des bêtas connectées, pas des masters certifiés. Cinematic est explicitement « bêta — transcription à vérifier » et son parcours web utilise désormais le planificateur autonome source-only, comme sa commande locale. Une transcription incertaine reste non validée.

Analyse importe et sauvegarde le rush dans un projet privé, mesure réellement l’audio avec FFmpeg, affiche les formules de ses deux indices acoustiques, les pauses horodatées et les actions à entreprendre. L’empreinte et la version `local-acoustic-v3` identifient le résultat mis en cache. Les critères éditoriaux restent non évaluables sans observations documentées : ces indices techniques ne représentent ni un score de viralité ni une analyse automatique du sens. **Monter cette vidéo** réemploie le même projet sans second envoi. Les tâches de rendu peuvent être retrouvées depuis les projets après navigation.

Le serveur de développement local n’est pas une URL publique. Un test sur Safari iPhone physique nécessite une origine HTTPS privée accessible depuis le téléphone ; aucun tunnel ou hébergement externe n’est activé automatiquement.

### Démarrage privé Windows + Safari iPhone

Suivre le [guide débutant](../../docs/social-plus/WINDOWS_IPHONE.md). Après les prérequis gratuits, exécuter `powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALLER-SOCIALPLUS.ps1`, configurer la règle pare-feu locale documentée et installer le certificat public sur l’iPhone. Ensuite, double-cliquer `DEMARRER-SOCIALPLUS.cmd`. L’application écoute uniquement l’IPv4 privée choisie sur HTTPS 8443 ; les moteurs et l’authentification existants sont conservés. Aucun accès Internet entrant, tunnel ni déploiement n’est configuré. Les données et clés locales ne doivent jamais être commises dans Git.
