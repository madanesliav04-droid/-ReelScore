# Social+ — issue #61, 28 octobre 2026

Cette livraison est **partielle** : le vrai frontend a été amélioré et testé, mais
les critères de fin de l’issue ne sont pas tous atteints. Aucun moteur artistique
n’a été remplacé ni modifié. Aucun score de qualité globale n’est attribué.

## Réutilisation vérifiée

- Base : PR #59, commit `7f86090e6b0ed76260999b079ee6bb512a964324` ; API, upload,
  reprise de jobs, moteur Alex et garde-fous de préproduction conservés.
- PR #60, `b398bc6cc6c55cae801692d221435c9611b22a89` : reprise sélective du backoff
  de queue et du statut ready. Les corps d’erreurs sensibles ne sont plus écrits
  par ces chemins de log. Pas de fusion des PR #58, #59 ou #60.
- La maquette Vercel HTML citée dans l’issue n’a pas remplacé le frontend Next.js.

## Existant / réalisé / manquant ou bloqué

| Élément | État vérifiable | Manque ou blocage |
|---|---|---|
| Interface française Social+ | Frontend réel, noms Analyse/Montage, thème graphite/violet, barre inférieure à quatre entrées | Validation esthétique du propriétaire et Safari physique |
| iPhone / ordinateur | Tests Chromium à 320, 390 et 1440 px, cibles tactiles 44 px, safe areas, reduced motion, capture jointe | VoiceOver, clavier et partage sur appareil physique non exécutés |
| Import | Picker et reprise existants conservés, drag-and-drop ajouté, limite 200 Mo conservée, erreur HTTP 402 explicite | Test distant authentifié et MOV/HEVC réels sur iPhone |
| Résultats | Progression reçue du serveur, reprise et téléchargement existants, partage de lien temporaire ajouté | Un job completed sans export accessible reste « Vérification du résultat » |
| Historique | Route filtrée par identité Auth vérifiée, 30 derniers jobs, réouverture via le flux existant | Pas de validation de cette nouvelle route sur Supabase isolé réel ; liste bornée, pas de pagination |
| Isolation UI | Historique vidé au changement de compte, anciennes réponses ignorées ; reprise de jobs par propriétaire conservée | Audit multi-comptes distant à exécuter |
| Analyse éditoriale | Moteur existant préservé, replay persistant par SHA réel + code moteur + modèles/configuration ajouté | Gemini et base isolée non disponibles pour un test complet sans frais |
| Stabilité | Deux imports identiques réutilisent la première analyse enregistrée pour le même propriétaire/empreinte | Test unitaire avec stockage/analyse simulés ; aucun nouveau score réel certifié |
| Queue worker | Backoff plafonné 60 s, ready distinct de configuration, logs de ces erreurs sans corps sensible | Connexion réelle au RPC et quota Supabase non résolus |
| Codie × OMNI | Code existant préservé ; interface dit explicitement ancien moteur bêta | V60 fidèle non certifiée par cette livraison |
| Alex Hormozi | Pipeline autonome existant préservé, activation explicite de contrôle | Rendu brut réel validé techniquement précédemment ; cinq incertitudes et fidélité à confirmer, aucun nouveau rendu cette étape |
| Leila Hormozi | Moteur contextuel existant conservé | Fidélité V53 et critères précis de l’issue non certifiés ici |
| Social Kinetic | Référence V28 conservée ; interface ne prétend pas ce worker raccordé | Source/pipeline validé à intégrer sans approximation et test de fidélité |
| Apple Spatial | Référence visible, bouton indisponible | Pipeline original non raccordé sur cette branche |
| Cinematic V7 | Moteur existant préservé, statut bêta explicite | Transcription, ressources narratives et fidélité non certifiées ici |
| UGC | Code historique conservé en laboratoire replié, hors des six modèles retenus | Non présenté comme modèle final validé |
| FAQ / confidentialité | Pages françaises réelles accessibles depuis Profil | Identité juridique, contact de droits, rétention déployée restent à compléter |
| Avis / administration privée / codes / accès | Aucun faux formulaire ni contrôle d’administration ajouté | Non développés dans cette itération ; doivent avoir stockage, autorisations et tests serveur avant activation |
| R2 privé | Bucket `socialplus-videos` déclaré par le propriétaire ; validation d’hôte d’upload renforcée | Accès, quota, domaines et purge 24 h non vérifiés faute de credentials |
| Preview Vercel | Configuration du vrai frontend prête, `/apercu` navigable sans faux compte ni résultat | Coût supplémentaire nul non confirmé : API coûts renvoie 404 `costs_not_found` ; aucun nouveau déploiement activé |

## Analyse reproductible : périmètre exact

`apps/worker/src/analysis-replay.js` calcule le SHA-256 du fichier réel côté worker
et l’empreinte des trois sources du moteur et de sa configuration. Le résultat
est recherché dans `viralplus_analyses`, filtré par propriétaire, SHA et empreinte.
Le premier résultat correspondant est réutilisé ; les scores ne sont pas recalculés.
En cas d’erreur de lecture, aucun nouvel appel IA potentiellement facturé n’est lancé.
La même empreinte est enregistrée dans le JSON et le SHA dans `video_sha256`.

Ce mécanisme suppose la table complète d’analyse existante, une seule exécution
concurrente et la conservation du résultat. Le bootstrap **Alex-only** ne fournit
pas cette table complète : ne pas y activer l’analyse. La suppression de l’analyse,
des changements de configuration ou plusieurs workers concurrents nécessitent des
contrôles complémentaires. Un premier appel Gemini non mis en cache n’est pas
présenté comme intrinsèquement déterministe. Aucun service IA n’a été activé.

## Vérifications exécutées

- Worker : **80 tests réussis**, 0 échoué. Comprend un vrai processus worker face à
  un serveur local simulant une erreur 402 puis une récupération ; aucune requête
  vers Supabase/Gemini/R2 n’est nécessaire à ce test.
- Régressions navigateur initiales : 27 réussies, 1 test conditionnel sauté.
- Lot ciblé après finitions : 18 réussies (responsive, sécurité des URL R2,
  reprise, partage des états et anciens parcours UGC).
- Aperçu déconnecté : vrai serveur Next.js refusant auth et API avec 503 ; test réussi.
- Build Next.js / TypeScript réussi, mode backend explicitement désactivé.
- Capture `ios-390.png` : vraie page `/apercu`, viewport Chromium 390 px, aucune
  donnée personnelle, aucun faux score ou média. Ce n’est pas un test iPhone physique.
- Première CI : https://github.com/madanesliav04-droid/-ReelScore/actions/runs/40684881427
  échouée sur le clic Analyse à 320 px : l’indicateur de développement Next.js
  interceptait le pointeur. Correction `devIndicators:false` conforme à la
  documentation de cette version ; aucune erreur runtime/compilation masquée et
  aucun clic forcé dans le test.
- **CI finale réussie** : https://github.com/madanesliav04-droid/-ReelScore/actions/runs/40685496439
  commit exécuté `0fe83b79154e42b316615aff740025716a40b07f`, job `122806678601`.
  Ubuntu 24.04 / Node 24 / Chromium Playwright : 80 tests worker, build et TypeScript,
  33 tests navigateur/API, deux tests conditionnels sautés puis exécutés avec leurs
  variables respectives : 1 backend déconnecté + 1 sélection Alex, tous réussis.
  Aucune clé métier ni vidéo personnelle ni artefact public envoyé. Ne pas assimiler
  ces tests contractuels à six rendus vidéo réels ou à Safari physique.

Les tests unitaires de replay utilisent un moteur et une base simulés ; ils ne
constituent pas une nouvelle analyse éditoriale réelle. Les anciens MP4 et preuves
restent privés dans le workspace et n’ont pas été téléversés dans le dépôt public.
Les moteurs artistiques n’ayant pas changé, aucun rendu personnel coûteux/redondant
n’a été relancé pour cette refonte d’interface.

## Accès et déploiement

`/dashboard` demeure authentifié. `/apercu` est une visite de l’interface sans
session, import, analyse ou rendu actif. Avec
`NEXT_PUBLIC_SOCIALPLUS_BACKEND_DISABLED=true`, les routes d’authentification et
de jobs retournent explicitement 503 avant tout appel amont et aucun retour vers
le backend de production n’est possible. Un simple HTML n’est jamais utilisé
comme preuve d’un montage opérationnel.

Déploiement à préparer sur le projet Social+ existant, cible Preview, racine
`viral-studio`, framework `nextjs`, commit de cette PR. Aucun alias de production
à affecter. La configuration Git automatique reste désactivée. Ne retirer aucune
protection Vercel sans contrôler l’exposition ; un partage temporaire d’aperçu peut
être utilisé après déploiement. Pas de worker vidéo dans Vercel Functions.

L’inventaire Supabase accessible le 28/10 ne retourne que `Liav CRM`, backend
connu de production. Il n’a pas été utilisé ou modifié pour cette livraison.
L’issue signale une erreur RPC 402 : il ne faut pas la transformer en migration
automatique de base, ni affirmer que le RPC est absent. Aucun test de quota live
ou mutation de données n’a été effectué ici.

**Prochaine action externe demandée :** confirmer dans Vercel DCEO → Billing/Usage
qu’une Preview standard supplémentaire reste incluse sans frais. Cela débloquera
uniquement la publication du frontend ; les deux parcours distants complets
nécessitent toujours un backend Auth/Storage/queue/worker isolé et validé à coût nul.
Cette PR ne clôt pas #61 et n’autorise aucune commercialisation automatique.
