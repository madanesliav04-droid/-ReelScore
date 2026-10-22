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
