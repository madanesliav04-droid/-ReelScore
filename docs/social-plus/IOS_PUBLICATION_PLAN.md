# Social+ — trajectoire iOS, sans migration native dans cette branche

## Choix technique

**Capacitor est le candidat recommandé pour un prototype iOS après la recette Safari physique**, car l’interface est déjà une application web de modules natifs avec navigation et API distinctes. Il permet de conserver l’interface et d’ajouter sélectivement un sélecteur vidéo et le partage natif. Aucune dépendance Capacitor, projet Xcode ou publication App Store n’est créé ici.

| Option | Réemploi | Contraintes | Décision |
|---|---|---|---|
| Web Safari / écran d’accueil | Interface et API actuelles | Onglet suspendu en arrière-plan, transferts à vérifier sur appareil | Étape de test actuelle, HTTPS local existant |
| Capacitor / WKWebView | UI et moteurs serveur conservés | Pont natif, origine/auth à traiter, transferts arrière-plan, validation App Store | Prototype suivant conseillé après recette réelle |
| SwiftUI ou React Native | API/moteurs seulement | Réécriture de l’interface et double maintenance sans besoin démontré | Pas justifié à ce stade |

Capacitor n’exécute pas automatiquement Python, FFmpeg, Chromium ou Whisper sur l’iPhone. Les six moteurs restent des traitements serveur. Leur certification artistique est indépendante de la coque iOS.

## Architecture conservée et séparation

- `public/app.js` : navigation et coordination des vues.
- `public/studio-ui.js` : présentation et règles d’affichage testables.
- `public/api-client.js` : adaptateur navigateur même origine, cookies HttpOnly et CSRF ; réponse d’une ancienne session rejetée.
- `public/media-client.js` : envoi mesuré, annulation à la fermeture de session et préparation du partage de fichier.
- `server/index.mjs` : API authentifiée et contrôle d’origine.
- `server/projects.mjs` : données privées et tâches persistées dans SQLite.
- `server/render.mjs`, `server/cinematic-plan.mjs`, `engines/` et `apps/worker` : moteurs réemployés, aucun import dans le bundle navigateur.

Le futur adaptateur natif doit être explicite. Le client actuel refuse les URL API externes : on ne doit pas supprimer ce contrôle pour faire fonctionner une coque. Une origine `capacitor://localhost`/`https://localhost` n’est pas la même origine que l’API actuelle. Choisir et tester le contrat de session natif, les cookies WKWebView ou un mécanisme de jetons révoquables stockés dans le Keychain, ainsi qu’une liste d’origines strictement définie. Ne pas ouvrir un CORS universel ni mettre un token dans localStorage.

## Étapes de publication

1. **Recette sur le matériel** : Windows, Safari sur iPhone réel, certificat local, import MOV/HEVC et MP4, veille/reconnexion, fichiers longs, partage OS et téléchargement. Tester avec VoiceOver, texte agrandi et clavier. Les émulations de viewport ne prouvent pas ces points.
2. **Certification des moteurs** : comparaison aux six masters, mots vérifiés, placements et formats verticaux pour chaque modèle. Cinematic reste bêta. L’analyse sémantique n’est pas disponible automatiquement ; ne pas la transformer en promesse commerciale.
3. **Serveur de préproduction privé** : hôte capable de Python/FFmpeg/Chromium/Whisper, stockage privé durable, sauvegardes, chiffrement et supervision. Valider capacité/durée des rendus sur la machine cible avant tout contrat. L’installation Wi-Fi est adaptée aux essais, pas à une publication App Store.
4. **Durabilité des tâches** : la V1 conserve les états SQLite et reprend leur affichage. Un redémarrage serveur marque une tâche interrompue en échec, sans reprise automatique d’encodage. Pour un service public, ajouter un worker supervisé et une file persistante avec idempotence, tentatives bornées, annulation et rétention. Garder les moteurs, remplacer uniquement l’orchestration après mesures.
5. **Prototype Capacitor** sur Mac/Xcode, sous branche distincte : navigation locale, sélecteur vidéo système avec accès minimal, partage de fichiers, transferts arrière-plan et reconnexion aux tâches serveur. Les MP4 doivent rester dans les safe areas ; tester leur orientation sans recadrage arbitraire.
6. **Confidentialité et sécurité** : compléter l’identité juridique réelle, finalités et durées de conservation, traitements de vidéos/voix et sous-traitants. Vérifier suppression du compte et des médias, export, révoquation et expiration des accès. Déclarer honnêtement les données traitées dans App Privacy et les manifests requis par les dépendances natives retenues.
7. **TestFlight** : compte Apple Developer, signatures et appareils réels. Le programme Apple peut être payant ; **aucune inscription ni dépense n’est autorisée ou engagée par ce plan**. Le propriétaire devra valider cette étape. Fournir à Apple un compte d’examen fonctionnel et des instructions d’accès, sans exposer le compte administrateur personnel.
8. **Soumission** : vérifier notamment la valeur fonctionnelle attendue par la règle App Review 4.2 (une simple enveloppe de site ne garantit pas l’acceptation), les données personnelles et la suppression du compte. Les six rendus et la revue d’analyse doivent fonctionner sur l’infrastructure cible. Toute commercialisation ou paiement numérique doit être étudié séparément ; aucun Stripe, achat intégré ni abonnement n’est ajouté ici.

Références : [Capacitor iOS](https://capacitorjs.com/docs/ios), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [App Privacy](https://developer.apple.com/app-store/app-privacy-details/).

## Conditions avant une décision native

Ne démarrer la migration qu’après mesure du parcours Safari réel, choix d’un backend capable de conserver les vidéos et tâches, et validation du contrat d’authentification. Le format actuel permet ce chemin sans réécrire les moteurs ; il ne constitue pas à lui seul une application iOS prête à publier.
