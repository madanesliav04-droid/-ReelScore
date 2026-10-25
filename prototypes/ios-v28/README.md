# Social+ — laboratoire iOS V28 local

Prototype isolé, pas une version validée ni une migration de Social+. Aucun moteur existant modifié. Aucun service distant, achat ou déploiement.

## Ce qui est préparé

- `prepare.mjs` vérifie les SHA-256 du verrou V28, appelle **la fonction existante** `referenceKineticHtml`, embarque le même GSAP et les mêmes polices que la capture existante. Aucun nouveau preset.
- Une composition privée est générée dans `Resources/` (ignorée par Git). Ni rush ni transcription ne sont publiés.
- L’application Swift importe le rush depuis Fichiers, contrôle son empreinte, ses dimensions, sa rotation et sa durée, puis échantillonne la timeline GSAP à 30 Hz dans WKWebView.
- AVAssetReader décode le rush ; WKWebView fournit les graphismes ; Core Image compose ; AVAssetWriter encode H.264. AVAssetExportSession passthrough ajoute **une** piste audio source, sans synthèse ni traitement de tonalité.
- Le MP4 n’est proposé au partage qu’après export terminé et contrôle du nombre de pistes audio/durée. Il reste temporaire : le partager vers Fichiers pour le conserver.
- Exécution au premier plan uniquement. Interruption : échec explicite et nouvel essai, pas de reprise automatique.

**Ce n’est pas encore testé sur iOS.** Les captures WKWebView transparentes, leur comportement lorsque la vue est rognée et les API Swift doivent être vérifiés avec Xcode puis un iPhone. La première expérimentation est volontairement limitée au rush approuvé, sans cuts nouveaux et sans transcription iOS. Aucune ancienne transcription n’est appliquée à un nouveau fichier : son empreinte serait rejetée. Cette étape compare deux technologies de rendu, elle ne prouve pas l’autonomie complète sur de nouveaux rushs.

## Risques visuels identifiés avant tout changement des moteurs

| Élément | Différence possible Chromium → WebKit / AVFoundation |
|---|---|
| Typographie | Métriques, césures, antialiasing ; polices système DejaVu/Arial différentes sur iOS malgré les fontes embarquées du chemin existant |
| Bulles et effets | Flous CSS, ombres, arrondis, stacking et transparence des snapshots |
| Animation | GSAP/règles identiques, mais publication des couches WebKit et snapshot peuvent différer ; vérifier chaque frame |
| Vidéo | Colorimétrie SDR/HDR, matrice YUV/RGB et orientation ; rotation non identité refusée ici |
| Encodage | H.264 Apple différent de libx264 : MP4 non identique octet par octet attendu |
| Synchronisation | PTS du décodeur, cadence variable, arrondi à 30 Hz et éventuel décalage initial des pistes |
| Audio | Remux passthrough prévu, mais conservation effective des échantillons et durée à comparer après export |

Ne pas remplacer les graphismes par Core Animation avant de mesurer ce chemin de réutilisation. Metal/Core Text seraient des ports supplémentaires, sans garantie automatique de fidélité.

## Préparation des ressources (Windows ou Mac, Node 24)

Depuis la racine du dépôt, après installation des dépendances existantes :

```powershell
cd apps/socialplus
npm ci
cd ../..
node prototypes/ios-v28/prepare.mjs C:/SocialPlus/plan-prive.json C:/SocialPlus/rush.mov
```

Le plan JSON contient `width`, `height`, `durationMs`, `referenceWords` (`text`, `startMs`, `endMs`) et `referenceDirection` validée (`layout`, `impacts`, `bubbles`, `captionRuns`). Utiliser le plan du rendu approuvé, pas un nouveau plan approximatif. La préparation n’embarque pas le rush : transférer séparément le même fichier sur l’iPhone, via iCloud Drive ou un transfert déjà disponible, sans achat. Les licences des ressources restent celles du dépôt ; toute distribution ultérieure nécessite leur revue et conservation des notices.

## Compilation : limite avec Windows + iPhone

Windows ne fournit pas Xcode, le SDK iOS ni la signature Apple. Installer une PWA ou ouvrir ces sources dans Safari **n’exécute pas** le code natif. Ce dépôt Linux ne permet pas non plus de produire un IPA signé.

Chemin sans nouvel abonnement : disposer temporairement d’un **Mac compatible avec la version de Xcode supportant l’iOS du téléphone**, emprunté ou déjà accessible. Un Mac distant implique aussi de résoudre l’accès au téléphone/signature ; aucun service de location n’est souscrit. Une CI macOS seule ne résout pas la signature et l’installation gratuite sur l’iPhone.

Sur ce Mac :

1. Installer Xcode depuis Apple, l’ouvrir et accepter ses composants. Ajouter son identifiant Apple dans Xcode > Settings > Accounts. Le Personal Team permet généralement le test personnel gratuit, avec restrictions et signature de courte durée (habituellement 7 jours) ; pas de TestFlight avec ce compte gratuit.
2. Copier le dépôt et les deux ressources privées générées. Installer XcodeGen depuis sa distribution officielle (outil gratuit, aucune commande d’achat).
3. Dans Terminal :

```sh
cd prototypes/ios-v28
xcodegen generate
open SocialPlusV28Lab.xcodeproj
```

4. Dans Signing & Capabilities, sélectionner son Personal Team, activer Automatically manage signing et choisir un Bundle Identifier unique si nécessaire.
5. Brancher l’iPhone au Mac, accepter « Faire confiance », activer Mode développeur dans Réglages > Confidentialité et sécurité si demandé, sélectionner cet iPhone dans Xcode puis Run.
6. Importer le rush identique depuis Fichiers. Garder Social+ ouvert ; partager le résultat vers Fichiers.
7. Après installation, couper le Wi-Fi et les données mobiles puis exporter à nouveau : cette opération doit réussir sans serveur et avec le PC éteint.

Apple Developer payant n’est pas nécessaire à ce premier essai personnel sur Mac avec les restrictions ci-dessus. Publication/TestFlight et éventuel hébergement de compilation sont des décisions séparées, non autorisées ici.

## Validation à effectuer réellement

1. Compiler : corriger uniquement l’adaptateur iOS si les API/versions l’exigent, jamais les moteurs verrouillés.
2. Vérifier la capture transparente : absence de rectangle noir/blanc, cadrage exact, absence d’écran vide. Si capture rognée/non disponible, adapter l’hébergement de la WKWebView dans le laboratoire.
3. Exporter le rush approuvé, mesurer durée, mémoire maximale et état thermique dans Xcode Instruments ; relever modèle iPhone/iOS. Arrêter en cas d’avertissement thermique.
4. Comparer avec `SocialPlus_Kinetic_V28_comparaison_master.mp4`, sortie approuvée SHA-256 `0fada3b5a2c4be4527f039f8bd3e06bca293d11c94ae87362456d841f2fe631b` : mêmes instants avant/pendant/après chaque entrée et sortie, puis vidéo intégrale et écoute. Comparer les overlays avant encodage pour distinguer rendu et compression.
5. Vérifier mots/positions, bulles, flous, easing, safe zones ; signaler séparément les mots ASR déjà incertains. Aucune validation phonétique nouvelle.
6. Contrôler H.264, format natif, une piste audio, lecture Fichiers/Safari et partage. Comparer audio décodé au rush et repérer tout décalage (pas seulement contrôler la durée).
7. Tester passage en arrière-plan, manque de mémoire/espace et mauvais rush : aucun faux succès ni fichier partiel proposé.

## Résultats exécutés dans l’environnement actuel

- Vérification des huit empreintes verrouillées : réussie lors de la préparation.
- Préparation du plan réel vertical approuvé : réussie, ressources conservées hors suivi Git.
- Chromium : composition locale initialisée, timeline accessible et positionnable à 0, 1, 10, 20 et 26 secondes ; aucune erreur JS ni requête HTTP externe.
- Compilation Swift/Xcode : **non exécutée**, outils Apple absents.
- WebKit, export iOS, écoute, comparaison des images iOS, mémoire, chauffe : **non exécutés**.

Verdict : candidat technique préparé ; fidélité et faisabilité sur appareil encore à établir. Aucun MP4 iOS produit ni score de qualité attribué.

## GitHub Actions — vérification préalable du 25 octobre 2026

Le dépôt cible est **déjà public** (`private:false` obtenu par API), sans changement de visibilité. Selon https://docs.github.com/en/billing/concepts/product-billing/github-actions, les runners GitHub standard y sont gratuits. Les quotas/factures du compte ne sont pas consultables avec l’intégration actuelle (`GET /users/madanesliav04-droid/settings/billing/usage` → 403), ni les permissions Actions (`GET /repos/.../actions/permissions` → 403).

Le workflow isolé utilise uniquement `macos-15` standard, 20 minutes maximum, aucun cache, aucun upload d’artefact, aucun secret et aucun déploiement. Il refuse de s’exécuter si le dépôt devient privé : dans ce cas, contrôler les quotas gratuits et le blocage des dépenses avant toute adaptation. Il compile puis installe/lance l’application sur un simulateur disponible. Ce lancement ne vérifie pas la capture ni l’export.

**Confidentialité :** rush, plan de transcription et master restent hors Git. Ils ne sont donc pas disponibles sur le runner. Ne pas les ajouter au dépôt public ni à des artefacts publics pour contourner ce blocage. Le test complet nécessite un transfert privé autorisé et temporaire des trois ressources, puis un mécanisme de récupération privée du MP4. Aucun stockage ni transfert externe supplémentaire n’est activé par ce workflow.

### Résultat réel de la première compilation distante

Exécution réussie : https://github.com/madanesliav04-droid/-ReelScore/actions/runs/40224907698 ; commit vérifié `439c6010b2ad47b400499b4760ceda29015b1984`.

Xcode 16.4 (16F6), runner macOS standard arm64, simulateur iPhone 16 Pro / iOS 18.5 : compilation, installation et commande de lancement réussies. Premier essai : arrêt au lancement ; ajout d’une signature ad hoc locale au binaire simulateur, puis second essai réussi. La santé continue de l’application n’est pas contrôlée par cette simple commande de lancement.

Aucun rush privé fourni au runner, aucun export exécuté et aucun artefact stocké. La capture WebKit, le MP4 et la fidélité restent **non testés**. Le point de terminaison des secrets Actions renvoie également 403 à l’intégration actuelle. Prochaine intervention nécessaire : permettre une configuration de secret Actions pour un canal temporaire privé de transfert, avant tout envoi des médias. Ne pas envoyer le secret dans une conversation ou le committer. Les accès doivent rester limités à ce test, sans toucher aux secrets de production.

## Export synthétique réellement exécuté — 25 octobre 2026

**Succès :** https://github.com/madanesliav04-droid/-ReelScore/actions/runs/40226896297

Commit testé `8d35128df684c1e95e24104032f2785869d15a3b`, Xcode 16.4, simulateur **iPhone 17 Pro / iOS 26.2**. Ce résultat complète les anciens résultats de lancement ; il ne valide pas iOS 18.5.

Le runner génère une mire vidéo et un son sinusoïdal à 440 Hz. Les libellés artificiels ne prétendent pas être une transcription. Le préparateur réutilise le HTML V28/GSAP existant ; les modèles ne changent pas. L’application reçoit `--synthetic-ci`, exécute le même `LocalRenderer.run` que l’import manuel et écrit le résultat dans son propre conteneur iOS. Aucun MP4 de secours n’est fourni par FFmpeg.

Le MP4 final a été produit par WKWebView → Core Image → AVAssetWriter H.264 → AVAssetExportSession avec audio source, en **13,4317 secondes**. FFmpeg est utilisé uniquement hors application pour créer la source artificielle et contrôler indépendamment le résultat.

Contrôles réussis sur le runner : **3,000 secondes, 320 × 568 natif, H.264/AAC, une piste vidéo et une piste audio, décodage complet, PCM source/sortie identique**. La variation dans les zones prévues confirme la présence du titre à 0,7 s et de la bulle à 1,7 s ; ce contrôle ne certifie pas les courbes d’animation ni la fidélité au master. Après récupération ici, le SHA-256 et le décodage ont été revérifiés, et les deux images ont été inspectées.

Fichier : `SocialPlus-synthetic-iOS.mp4`, **696 218 octets**, SHA-256 `126201129dde3d1bdf54466777baff3bb1761fc2daf61e30043d1a6a5c976c47`.

### Erreurs rencontrées et corrections isolées

- Verrou HTML : le fichier GitHub historique omettait **un seul LF final**. Le préparateur accepte désormais le hash verrouillé exact, ou celui obtenu en ajoutant exactement ce LF ; aucune autre différence n’est acceptée. Aucun fichier moteur n’a été changé.
- Arrêt après lancement : `Library not loaded: /usr/lib/swift/libswiftWebKit.dylib` sur le runtime iOS 18.5. Sélection du runtime disponible le plus récent, intégration des bibliothèques Swift et désactivation du debug dylib dans le projet du laboratoire. L’ancien test de simple lancement ne suffisait pas à détecter cet arrêt.
- La vue de capture est maintenant visible dans le laboratoire ; les attentes de frames/captures sont bornées et l’étape native courante est enregistrée. Le premier essai expirait sans résultat d’export : ces changements ne constituent pas une modification des animations.
- La fin de session AVAssetWriter est fixée à la durée source.

### Récupération et confidentialité

Aucun `upload-artifact` ni cache : quota de stockage inaccessible, et dépôt déjà public. On ne peut donc pas promettre un artefact privé gratuit ici. **Seulement pour ce test artificiel**, le MP4 est encodé entre `SYNTHETIC_MP4_BASE64_BEGIN` et `SYNTHETIC_MP4_BASE64_END` dans les logs de vérification. Les logs sont publics ; ne jamais employer ce procédé pour un rush personnel, une transcription réelle ou un master privé.

Le fichier a été récupéré dans `/workspace/socialplus-private-renders/ios-synthetic-export/SocialPlus-synthetic-iOS.mp4`, hors Git. Le rapport sans média est `SYNTHETIC_RESULTS.json`.

**Limites :** aucun iPhone physique testé, aucun test de parole ou de transcription dans cette mire, aucune comparaison au master privé, aucune certification artistique V28. La preuve acquise porte sur la génération native effective d’un MP4 synthétique dans le simulateur, sans moteur de montage serveur.
