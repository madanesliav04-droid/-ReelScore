# Social+ V18 — application privée locale

Accueil, Montage et Stratégie utilisent une base SQLite persistante et des fichiers privés locaux. Le propriétaire se provisionne dans le terminal avec MFA. Le quota de calcul est limité par défaut à 10 traitements par membre et jour UTC (`SOCIALPLUS_MAX_RENDERS_PER_DAY`). Supprimer un projet ne remet pas ce compteur à zéro. Aucun compte de démonstration n’est activé au lancement et aucun service externe facturé n’est appelé.

Avec Node.js 24, FFmpeg et FFprobe installés :

```sh
cd apps/socialplus
npm run owner
npm start
```

Ouvrir `http://localhost:4318`. Le script propriétaire initialise `.env.local` sans remplacer les paramètres existants. Les invitations sont transmises manuellement après vérification personnelle du destinataire. Les pages juridiques restent des brouillons tant que l’identité et le contexte réels ne sont pas renseignés.

```sh
npm test
```

Le lancement et les tests du serveur n’exigent aucune dépendance npm. Le script facultatif `scripts/browser-smoke.mjs` exige Playwright Core et Chromium déjà installés ; il peut utiliser `PLAYWRIGHT_MODULE_PATH` et `CHROMIUM_PATH`. Il crée uniquement une base temporaire et une vidéo technique générée, puis supprime les comptes de test. Il ne déploie rien.

- [Guide Windows](../../docs/social-plus/WINDOWS_LOCAL.md)
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
