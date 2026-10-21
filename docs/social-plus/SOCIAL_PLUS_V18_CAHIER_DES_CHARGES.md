# SOCIAL+ — CAHIER DES CHARGES TECHNIQUE V18 (V1 PRIVÉE)

**Date :** 22 octobre 2026  
**État :** V18 de passation Codex, V1 privée et gratuite uniquement sur invitation ; commercialisation et Stripe différés — **aucune modification du projet effectuée**  
**Priorité :** conserver l'existant ; livrer une V1 utilisable et testable comme un site web au format app iOS premium, sans données inventées, sans abonnement d'infrastructure obligatoire au lancement.

> **ARBITRAGE PRÉVALENT V18 :** toutes les mentions antérieures de paywall, abonnement, checkout, Stripe et commercialisation concernent uniquement la **phase commerciale future**. **La V1 ne prend aucun paiement**, ne montre aucun tarif, n'active aucune facturation ni intégration Stripe, et n'autorise l'accès qu'au propriétaire et aux utilisateurs invités gratuitement. Les nouveaux écrans visibles sont **Accueil · Montage · Stratégie** ; performances dans Stratégie, pages d'aide et de droit dans le compte. Design inspiré d'iOS (Liquid Glass discret) mais **site web responsive**, pas application App Store. Aucun rôle admin délégué : **un seul propriétaire admin**. Les sections de ce document doivent être interprétées selon cet arbitrage, sans coder la commercialisation.

> **PASSATION CODEX 22/10/2026 — V18 :** le projet cible est un **SITE INTERNET RESPONSIVE AU FORMAT APPLICATION iOS**, pas une application SwiftUI native. L'accès est **100 % privé, gratuit et sur invitation**, sans Stripe, sans tarifs et sans commercialisation. **Social+** est la seule marque publique. Navigation : **Accueil / Montage / Stratégie**, statistiques dans Stratégie, compte/Aide via avatar. **ADMIN = propriétaire unique**, permissions vérifiées serveur, invitation équipes 7/30 jours ou permanente, FAQ éditable, feedback privé, conformité RGPD. **6 styles de montage validés visuellement**, dont **Cinematic Storytelling V7 finale** (Python + FFmpeg, pas Hyperframes pour la V7). Vérifier physiquement les sources et faire des exports réels avant d'annoncer un moteur prêt. Ne pas retoucher la prod ni payer des services sans autorisation.

## A. CONTRAT PRODUIT ET NON-NÉGOCIABLES

1. **Marque publique unique : Social+.** Ne plus exposer « Edit+ », « Viral+ » ni « Clip+ » dans les menus, pages, offres, e-mails et messages visibles. Noms fonctionnels : **Studio** (montage) et **Stratégie** (audit + pédagogie + analyse + suivi).
2. **Une seule plateforme premium mobile-first**, optimisée iPhone et PC, et un seul compte utilisateur. Préserver toutes les fonctionnalités/vidéos/modèles déjà validés ; ne pas réécrire Studio avant audit des dépendances et tests de non-régression.
3. **V1 privée et gratuite pour l'équipe : aucun paiement, prix ni carte bancaire.** Accès uniquement par invitation du propriétaire (adresse e-mail ou code personnel), 7 jours, 30 jours ou sans expiration, révocable. Les futurs abonnements, tarifs et réductions sont hors périmètre V1.
4. **Social+ enseigne le PROCESSUS.** Chaque recommandation a constat, preuves, source/méthode, explication, procédure, exercice à réaliser soi-même, indicateur de réussite et cycle de réévaluation. Ne pas générer intégralement la bio, les scripts ou le calendrier à la place du créateur par défaut.
5. **Zéro preuve / statistique / analyse fictive dans le produit.** Donnée absente = « non disponible » ou « non évaluable ». Les exemples démonstratifs doivent porter explicitement la mention « Exemple fictif ».
6. **Score fiable et stable.** Un score prépublication est un score de préparation **éditoriale**, jamais une probabilité de viralité ni une prédiction de vues. Même fichier + contexte + version de moteur = même résultat. Les critères non observables ne reçoivent pas de valeur inventée.
7. **Sécurité dès la V1.** Autorisations et permissions admin côté serveur, isolation des données de chaque utilisateur, audit des accès et invitations. La vérification Stripe reste une exigence pour la future phase payante.
8. **Pas de migration aveugle.** Avant de modifier un projet existant, identifier sa source Git, son hébergement, ses dépendances, son stockage, l'architecture audio/vidéo et l'ensemble des modèles Studio déjà validés.
9. **Priorité 0 € de frais fixes** pour prototype et tests limités ; ne jamais souscrire à un service payant sans autorisation. Les coûts de calcul/rendu vidéo et les limites des offres gratuites doivent être mesurés même sans paiements.

## B. ÉCRANS ET PARCOURS UTILISATEUR

### B1 — Navigation publique et client

- Entrée publique minimale : présentation courte de Social+, connexion et activation d'une invitation ; aucune offre ni tarifs en V1. Afficher les mentions légales et confidentialité accessibles même avant connexion.
- Inscription/connexion **sur invitation uniquement** : adresse e-mail vérifiée, réinitialisation si mot de passe, acceptation des CGU et information RGPD ; protections anti-bot et anti-bruteforce ; ne pas laisser créer un compte actif sans invitation.
- **Aucun paiement, aucun abonnement, aucun checkout ni code promotionnel Stripe en V1.** Ces fonctionnalités sont réservées à la phase commerciale future.
- Activation d'accès invité : **invitation e-mail ciblée ou code gratuit** personnel sur écran d'activation, sans carte ni abonnement ; message explicite « Accès gratuit, aucune facturation ».
- **Accueil Social+ :** dernière activité, projets et progression réelle ; bouton nouveau montage, action Stratégie ; une seule identité de marque.
- **Montage** (espace fonctionnel Studio en interne) : import rush, choix des 6 modèles artistiquement validés, aperçu, corrections, export ; chaque moteur est activable uniquement après recette technique réelle ; conserver les codes et rendus existants.
- **Stratégie — Profil :** objectifs, niche, audience, profil, bio, positionnement, lien et parcours ; questionnaire concis et données facultatives.
- **Stratégie — Performances :** import CSV normalisé / saisie manuelle, historiques, graphiques, comparaison explicable ; source visible.
- **Stratégie — Concurrence :** entrée manuelle de 3 à 5 profils, comparaison de données publiques autorisées, analyse qualitative et exercices.
- **Stratégie — Mes missions :** trois priorités maximum, fiches pédagogiques, cases à cocher, preuves d'exécution, historique.
- **Stratégie — Analyse de vidéo :** fichier local, objectif, analyse de la narration/forme selon capacités, timestamps, critères observables, correctifs à faire soi-même.
- **Stratégie — Résultats :** association d'une publication réelle à une analyse précédente ; mesure à 24 h, 7 j, 28 j si les données existent ; conservation des snapshots.
- **Compte / Aide** (depuis avatar) : profil, statut de son accès gratuit et échéance, FAQ, Donner mon avis, Contacter le support, Politique de confidentialité, CGU, Mentions légales, préférences cookies si nécessaire, export/suppression des données, déconnexion. Aucune rubrique abonnement ou résiliation en V1.

### B2 — Panneau admin (URL privée, non listée dans la navigation publique)

- Dashboard privé propriétaire : utilisateurs actifs, invitations émises/utilisées, accès expirant prochainement, consommation/quota, remontées de bugs et avis ; **aucune métrique de revenus Stripe en V1**.
- Membres : recherche, e-mail, équipe/groupe facultatif, état d'accès gratuit, échéance, dernière activité utile (sans lire les contenus privés), réinvitation, prolongation, suspension/révocation avec journal.
- Tarification : **désactivée et invisible en V1** ; architecture de tarification Stripe conservée seulement en spécification future.
- Promotions payantes : **désactivées et invisibles en V1** ; prévues pour commercialisation ultérieure.
- Invitations gratuites (priorité V1) : invitation directe par e-mail OU code secret, 7/30 jours/permanent, expiration du code et de la permission distinctes, un seul usage par défaut, quota configurable, liaison à un e-mail/équipe si souhaitée, révocation, renvoi sûr, aucune carte.
- Bibliothèque : consulter/éditer/publier/désactiver les 12 méthodes, leurs versions, sources, déclencheurs, processus et indicateurs.
- Audit : événements administratifs horodatés avec acteur/action/cible/résultat, sans consigner de secrets ni de vidéos privées.
- Configuration : activer/désactiver modules, limites d'usage, intégrations ; **identité unique de propriétaire établie hors UI** ; MFA obligatoire pour ce compte ; aucun membre ne peut devenir admin par inscription, code ou manipulation client.

### B3 — Principes UX

- Mobile-first web au **format app iOS premium** : maquette validée (ambiance graphite, typographie claire, grands aperçus vidéo, barre flottante à trois onglets Accueil/Montage/Stratégie, Liquid Glass discret) ; mode clair/sombre, geste tactile naturel et adaptation PC. Pas d'application native ni d'App Store en V1 ; pas de faux chiffres, éléments factices ou scores décoratifs.
- États pour chaque action : vide, en cours, terminé, données insuffisantes, quota épuisé, erreur récupérable, permission refusée.
- Retours explicites et accessibles, textes courts en français, contrastes WCAG, navigation clavier et labels d'entrée.
- Demander le minimum d'informations à la fois. Ne pas imposer 30 vidéos pour accéder à l'audit de bio.

## C. ARCHITECTURE TECHNIQUE CIBLE (SOUS RÉSERVE D'AUDIT)

- **Frontend :** conserver framework et design system existants s'ils sont maintenables ; site responsive/PWA possible mais **ne pas** créer d'app store native pour la V1.
- **Backend léger et API :** Cloudflare Workers Free comme option préférée pour auth, CRUD, diagnostics déterministes courts et webhooks (100 000 requêtes/j et environ 10 ms CPU par requête gratuits, limites à revérifier avant déploiement).
- **DB transactionnelle :** Cloudflare D1 candidat (5 Go total offert, max 500 Mo par base gratuite, 5 M lignes lues/j, 100 k lignes écrites/j). Index et requêtes bornées ; surveillance proactive des quotas. Si l'existant est Supabase, **ne pas migrer** sans mesures, comparaison et tests de parité : conserver Supabase peut être moins coûteux/risqué qu'une migration.
- **Authentification :** solution maintenue compatible avec framework/runtime ; ne pas présumer que Better Auth ou un module existant fonctionneront sans adaptation. Sessions en cookie `HttpOnly`, `Secure`, `SameSite`, CSRF, expiration et renouvellement sûrs, MFA propriétaire. Aucun secret dans le client.
- **IA :** moteur déterministe prioritaire. Option Workers AI gratuit sous quota (~10 000 neurones/jour) pour interprétation si modèle disponible et autorisé ; en échec, retour du diagnostic déterministe et indication explicite « analyse approfondie indisponible ». **Aucun achat automatique.**
- **Vidéo :** fichiers conservés localement par défaut, `ffmpeg.wasm`/WebCodecs si supportés ; prévoir fallback testable pour Safari iOS, mémoire, CPU, fichiers > capacité appareil. Ne pas traiter d'export vidéo lourd dans Workers Free. Un workflow serveur existant peut rester nécessaire pour Studio ; son coût doit être chiffré avant lancement.
- **Transcription :** option locale selon capacité de l'appareil et accord utilisateur. Sans transcription fiable, ne pas évaluer narration/hook sémantique comme si le discours était connu ; accepter transcription fournie par l'utilisateur.
- **Stripe : HORS V1, désactivé, aucune clé de production, aucun Checkout/Portal ou webhook nécessaire au lancement privé.** Contrats de paiement et test de webhooks restent réservés au lancement commercial futur.
- **Connexion réseaux :** v1 saisie/CSV/captures annotées de provenance. OAuth API officielle **uniquement après** autorisations Meta/TikTok ; ne pas scraper des profils privés, contourner les protections ou prétendre accéder aux métriques inexistantes.
- **Observabilité :** logs serveur sans données sensibles, monitoring erreurs, consommation AI/Workers/DB, backups testés, plan de restauration documenté.

## D. MODÈLE DE DONNÉES CIBLE

Tables minimales (identifiants internes UUID/ULID ; timestamps UTC ; `owner_user_id` + clés étrangères + index) :

1. `users`: id, email_verified_at, display_name, created_at, disabled_at.
2. `sessions` / `auth_credentials`: selon fournisseur, tokens signés/rotatifs, sécurité ; ne pas stocker de mot de passe en clair.
3. `roles`: user_id, role (`owner`, `member`), granted_by, granted_at. **Aucun rôle owner auto-déclarable**.
4. `creator_profiles`: id, user_id, platform, handle, target_audience, niche, offer, bio_text, goal_type, goal_details, updated_at.
5. `consents`: id, user_id, purpose, version, granted_at, withdrawn_at.
6. `content_items`: id, user_id, platform, external_post_id nullable, publication_at, duration_ms, format, topic, hook_text, caption, local_file_fingerprint nullable.
7. `metric_snapshots`: id, content_id nullable, user_id, collected_at, observation_start/end, source_kind (`manual`, `csv`, `api`), provider, metric_key, raw_value, unit, denominator_kind nullable, proof_ref nullable, verified_flag. Unicité logique source/item/metric/instant ; imports idempotents.
8. `imports`: id, user_id, source_kind, original_name, schema_version, checksum, state, errors, created_at.
9. `competitors`: id, user_id, platform, handle, source_public, collected_at, relevant_notes.
10. `methods`: id (`M01`..`M12`), slug, title, category, active_version, enabled.
11. `method_versions`: id, method_id, version, source_title, source_url, last_verified_at, applicability, prerequisites_json, trigger_rules_json, process_steps_json, pitfalls_json, success_metrics_json, approved_by, published_at.
12. `diagnostic_runs`: id, user_id, engine_version, input_hash, input_snapshot_json, status, generated_at, goal_type.
13. `findings`: id, run_id, rule_id, observation_json, evidence_refs_json, evidence_level (`measured`, `estimated`, `unavailable`), priority_score nullable, confidence_level, method_version_id nullable, why_text, caveats_json.
14. `missions`: id, user_id, finding_id, method_version_id, title, status, created_at, due_at nullable, completed_at nullable.
15. `mission_steps`: id, mission_id, ordinal, description, completed_at nullable, completion_note nullable.
16. `experiments`: id, user_id, goal_metric, hypothesis, started_at, ended_at nullable, baseline_snapshot_refs_json, post_snapshot_refs_json, conclusion (`improved`, `unclear`, `worsened`, `not_evaluable`), caveat.
17. `video_analyses`: id, user_id, content_fingerprint, context_hash, engine_version, subscore_schema_version, criterion_results_json, excluded_criteria_json, score nullable, findings_json, created_at.
18. `plans` : **futur paiement seulement** ; aucune table Stripe nécessaire au fonctionnement initial des accès gratuits.
19. `subscriptions` : **futur paiement seulement**, non utilisée en V1.
20. `discount_promotions` : **futur paiement seulement**, non utilisée en V1.
21. `access_grants`: id, user_id, kind (`owner`, `paid`, `gift`), source_id, starts_at, expires_at nullable, revoked_at nullable, created_by.
22. `invitation_codes`: id, code_hash, code_prefix, grant_duration_kind, max_uses, uses, expires_at nullable, target_email_hash nullable, is_active, created_by; **codes bruts non stockés**.
23. `code_redemptions`: id, code_id, user_id, redeemed_at, grant_id, UNIQUE(code_id,user_id), transactions atomiques sur usages.
24. `stripe_events` : **future commercialisation seulement**, aucune réception Stripe en V1.
25. `admin_audit_logs`: id, actor_id, action, target_kind, target_id, before_redacted_json, after_redacted_json, request_id, result, created_at.
26. `data_deletion_requests`: id, user_id, requested_at, verified_at, completed_at, status, retention_exceptions_json.
27. `teams` (facultatif) : id, label, created_by_owner ; aucune permission admin ou accès automatique à des données membres.
28. `team_memberships` (facultatif) : team_id, user_id, added_at, unique(team_id,user_id).
29. `faq_entries` : id, question, answer, sort_order, published, updated_by_owner, updated_at.
30. `feedback_submissions` : id, user_id, category (`avis`, `idee`, `bug`), rating nullable (1..5), body, created_at, triage_state, owner_reply nullable, user_opt_in_publication_at nullable.
31. `privacy_documents` : id, kind (`privacy`,`terms`,`legal`,`cookies`), version, body, effective_at, publisher_id ; approbation par le propriétaire après renseignement des informations réelles.
32. `support_requests` (ou réutiliser feedback) : id, user_id nullable, channel, message, status, created_at, resolved_at nullable.

Règles DB : `user_id` systématiquement vérifié par l'API ; pagination et index pour requêtes utilisateur ; pas d'accès cross-tenant ; `raw_value` nullable distinct de `0`. Conserver unités et fenêtres d'observation. Aucun mélange silencieux de portée vs vues.

## E. CONTRAT D'IMPORT ET MÉTRIQUES

### E1 — Import

- Import manuel et CSV : mapper les colonnes, vérifier la plateforme et la période, montrer aperçu + erreurs avant confirmation.
- Contrôler fichiers malformés, valeurs négatives impossibles, zéro vs champ manquant, doublons, dates incohérentes, locale FR (virgule décimale), fuseau et caractères spéciaux.
- Captures d'écran : pièce justificative possible mais **pas** extraction automatique supposée fiable ; corrections/validation humaine des chiffres avant calcul.
- Marquer origine, date et niveau de vérification, durée d'observation, portée/vues/visites, source de chaque mesure.
- Statistiques sociales de différentes plateformes : **ne pas agréger en un seul taux** sans règle explicite et équivalence prouvée. Les définitions de vues et de visibilité peuvent changer selon les plateformes.

### E2 — Indicateurs

- `share_rate = shares / reach * 100` uniquement si `reach > 0` et share/reach disponibles.
- `save_rate = saves / reach * 100` idem.
- `engagement_rate = (likes+comments+shares+saves)/reach*100` si tous les composants requis sont disponibles ; sinon afficher formule partielle **étiquetée** ou non évaluable.
- `profile_action_rate = follows_attributed / profile_visits*100` **uniquement si la relation d'attribution est documentée** ; sinon « ratio indicatif de période », pas « taux de conversion attribué ».
- `watch_ratio = average_watch_seconds / video_duration_seconds * 100` si mêmes définitions, unités et cohorte; le ratio peut dépasser 100 % à cause des relectures, ne pas tronquer arbitrairement.
- `lead_conversion_rate = attributed_qualified_leads / tracked_visitors * 100` uniquement si attribution fiable.
- Comparaison : même réseau, format/durée similaires, date/ancienneté d'observation comparable et objectifs similaires ; seuils 5–9/10 contenus = heuristique de confiance **interne**, non seuil officiel des plateformes.

### E3 — Prise de décision

- Aucune note globale d'un compte sans données et dimension mesurée bien définie. Préférer diagnostic multi-dimensionnel.
- La gravité, l'impact, la qualité des preuves, l'effort estimé sont déterministes et documentés.
- `priority = round(100 * (0.35*impact/5 + 0.30*gap/5 + 0.25*confidence/5 + 0.10*ease/5))` **seulement pour candidat éligible** ; composantes 0 à 5, règles versionnées.
- Critère requis absent => « non évaluable », pas score 0. Faible échantillon => mission « collecter/vérifier » prioritaire au lieu d'une recommandation péremptoire.
- Fusionner les diagnostics ayant une cause hypothétique commune ; proposer trois missions maximum ; tie-break stable par rule_id.
- Pour les recommandations : `observation`, `evidence`, `hypothesis`, `why_method`, `step_by_step`, `how_to_measure`, `source_url`, `confidence`, `limitations`.

## F. BIBLIOTHÈQUE PÉDAGOGIQUE V14 — 12 MÉTHODES

Le moteur n'invente pas de méthode. Chaque fiche renvoie à une source exacte et porte sa **version**. L'équipe éditoriale garde le droit de réviser une interprétation et un avertissement.

| ID | Déclencheur admissible | Mission que l'utilisateur exécute | Vérification | Référence |
|---|---|---|---|---|
| M01 Audience idéale | Audience/objectifs non définis ou cohérence à clarifier | Définir segments, problèmes, interroger une partie de l'audience | Signaux qualitatifs + pertinence des abonnés | Hormozi `$100M Leads` (adaptation) |
| M02 Promesse | Bio/promesse peu intelligible | Définir cible + bénéfice + preuve + prochaine action | Test compréhension + action/visites si mesurable | Hormozi `$100M Offers` (adaptation) |
| M03 Piliers | Thèmes dispersés au vu des contenus | Classer contenus, définir 2–4 piliers et objectifs | Répartition + résultats par pilier | Hormozi Mozi Media (adaptation) |
| M04 Hook | Problème visible/étayé d'ouverture | Identifier promesse, réviser début, tester variantes | Attention initiale si disponible | TikTok Creative Codes (cadre de création) |
| M05 Structure | Progression narrative peu claire | Hook → développement → bénéfice/conclusion | Compréhension, performance postpublication | TikTok Hook/Body/Close (adaptation) |
| M06 Rétention | Chute **mesurée** et localisée | Relire timestamps, poser hypothèse, tester variante | Courbe de rétention comparable | YouTube Analytics |
| M07 Partages | Taux de partage historiquement inférieur | Étudier posts transmis, concevoir valeur transmissible | Partages / portée comparable | Meta Best Practices + expérimentation |
| M08 Concurrence | Différenciation incertaine | Comparer comptes publics, relever opportunités, tester angle propre | Retours audience + performance de test | Méthode Social+ / TikTok Creative Center |
| M09 Plan | Pas de stratégie reliant posts aux objectifs | Définir piliers, cadence réaliste, tests, revue périodique | Exécution + KPI objectif | Hormozi + méthode Social+ |
| M10 Lead magnet | Entreprise visant prospects, audience clarifiée | Identifier problème, construire ressource personnelle, tester parcours | Leads qualifiés attribués | Hormozi Lead Magnet Mastery |
| M11 Acquisition | Vues/clics existants mais parcours prospects flou | Cartographier parcours, supprimer une friction, mesurer | Taux clic → prospect qualifié | Hormozi `$100M Leads` |
| M12 Expérimentation | Résultats incertains/contradictoires | Hypothèse, baseline, test, mesure, conclusion | Réplication/qualité des preuves | Méthode Social+ + outils des plateformes |

L'utilisateur produit lui-même les bios, textes, hooks, scripts et calendriers par défaut. L'IA peut expliquer/illustrer une méthode sans livrer automatiquement un travail complet non demandé. Ne pas reproduire intégralement de supports protégés.

## G. ANALYSE VIDÉO PRÉPUBLICATION (STUDIO DE STRATÉGIE)

- Import local, contrôle format, rotation, ratio natif, piste audio, durée ; erreur claire si non supporté.
- Audio : détection de clipping/silence *si analysable* ; ne pas prétendre diagnostiquer l'intelligibilité sémantique sans transcription fiable.
- Visuel : zones de texte, contraste, lisibilité, safe-zone selon format et plateforme (règles versionnées) ; métriques uniquement si disponibles.
- Narration : analyser transcription fiable fournie/détectée ; repérer introduction, message, preuve, structure, CTA avec timestamps si alignement temporel vérifié.
- Score prépublication V7 initial : Hook 15, Scroll Stop 10, Clarté 12, Rétention **potentielle** 10, Structure 12, Rythme 8, Texte 7, Visuel 6, Audio 6, Originalité 7, CTA 7 = 100. **Attention : ce sont des poids à calibrer, pas une vérité algorithmique.**
- Les critères non évaluables sont exclus du dénominateur (`score = somme(points_obtenus_évaluables)/somme(points_max_évaluables)*100`) seulement si couverture suffisante ; afficher **couverture X/Y** et les exclusions. Couverture basse (< 60 % proposé à valider) => **pas de score global**. Ne pas confondre score avec performance future.
- Même fichier (`SHA-256`), contexte normalisé, critères et versions => résultat déterministe. Si IA non déterministe intervient, **ne pas utiliser sa sortie brute pour le score** ; figer les caractéristiques validées ou scores calculés sans IA.
- Toute erreur a timecode/prévisualisation si possible, nature, preuve, procédure de correction, limites de détection.
- Après publication, comparer le score de préparation sauvegardé aux statistiques réelles **sans réécrire l'ancien score**.

## H. STUDIO — MODÈLES DE MONTAGE RETENUS (V16.2)

### H0 — Contrat d’intégration : n’inclure que les modèles retenus

**Identité produit :** seul « Social+ » apparaît comme marque commerciale. Dans Social+ l'espace de montage s'appelle **Studio**. Les références créatives peuvent continuer à s'appeler « Codie × OMNI », « Alex Hormozi », « Leila Hormozi », etc. dans le sélecteur de styles, sous réserve de disposer des droits et des assets nécessaires. Les anciens noms de **produit** « Edit+ », « Viral+ » et « Clip+ » ne doivent pas réapparaître dans l'interface.

**Ne rien inventer :** les noms V16/V28/V53/V60 désignent des **références de travail historiques**, pas la preuve qu'un moteur reproduit déjà ces styles à l'identique. La validation d'un **rendu manuel ou visuel** n'est pas la certification du **montage automatique sur un nouveau rush**. Avant codage, retrouver les MP4 maîtres, rushs source, projets, assets, branches et audits correspondants dans les espaces existants ; noter les identifiants réels, chemins, SHA-256 et statut de chaque artefact. Si un maître manque, demander/localiser l'archive plutôt que le reconstituer à l'aveugle.

#### H0.1 — Catalogue conservé et statut de validation (au 21 octobre 2026)

| Preset / direction | Référence retrouvée | Statut produit / mise en service |
|---|---|---|
| **Codie × OMNI** (unique modèle Codie ; ne pas créer un doublon « Codie Sanchez ») | **V60** ; DA validée historiquement | **Référence artistique verrouillée** ; autonomie et robustesse à certifier |
| **Alex Hormozi × OMNI** | **V16** (référence retenue) | **Référence visuelle validée** ; synchronisation mot-à-mot, export et autonomie à revalider |
| **Leila Hormozi** | **V53**, dernier choix utilisateur le 21/10 ; sous-titres mot-à-mot acceptés, 6 cuts intelligents annoncés | **Référence de montage verrouillée par l'utilisateur** ; intégrer telle quelle, puis **tester la reproduction automatique** |
| **Social Kinetic** | **V28**, référence de travail à recouper avec le master finalement approuvé | **Modèle validé par l’utilisateur** ; reproduction automatique sur nouveaux rushs à tester |
| **Cinematic Storytelling / cinématique** | **V7 FINALE**, approuvée par l’utilisateur le 22/10/2026 ; rendu via **Python + FFmpeg**, prototype Hyperframes séparé et non utilisé pour V7. Archive source annoncée de 38 Mo et script sans médias de 25 Ko, **non disponibles physiquement dans ce dossier** | **Référence créative verrouillée** ; sources V7 à récupérer et tester avant activation du moteur autonome |
| **Apple Premium / Spatial UI** | **Apple Premium V4**, **Spatial UI V1** (références de travail à rapprocher du master confirmé) | **Modèle confirmé par l’utilisateur** ; reproduction automatique sur nouveaux rushs à tester |

**Catalogue retenu uniquement :** Codie × OMNI, Alex Hormozi × OMNI, Leila Hormozi, Social Kinetic, Cinematic Storytelling et Apple Premium / Spatial UI. **Six modèles sont validés/confirmés comme références créatives par l’utilisateur**, incluant Cinematic Storytelling V7 finale. **Aucune validation visuelle ne certifie encore la fiabilité de génération automatique sur de nouveaux rushs.** Cette validation créative ne prouve pas encore le fonctionnement autonome du moteur sur un nouveau rush. **Ne pas inclure d'anciens presets, de variantes abandonnées ni de modèles d'archives dans le catalogue ou les tâches d'intégration.** Aucun « bientôt disponible » trompeur : afficher une indisponibilité explicite lorsque le moteur n'existe pas ou échoue.

### H1 — Contrat audiovisuel global, applicable à tous les modèles

1. **Montage intelligent, pas preset cosmétique :** chaque modèle a sa propre grammaire de cuts, cadrages, transitions, sous-titres, motion design, B-roll et sound design. Une simple variation de couleurs ne suffit pas.
2. **Compréhension narrative :** détecter idées, arguments, énumérations, termes clés, moments de preuve et pauses naturelles avant de placer les effets. Un visuel est justifié par la phrase qu'il illustre. Ne jamais inventer chiffre, résultat, témoignage ou image présentée comme preuve.
3. **Cuts intelligents :** raccourcir blancs utiles/inutiles selon le contexte, couper de préférence aux respirations ou changements d'idée ; **jamais** couper un mot ou une phrase au hasard, produire de jump-cut gratuit ou inverser le sens. Conservation de la continuité audio/vidéo ; resynchroniser **toutes** les pistes et couches après chaque coupe.
4. **Audio original :** une **seule voix d'origine** perceptible ; éviter l'effet « doublage » ou écho, aucun remplacement IA, pitch-shift ni modification de timbre non voulue. Sound effects seulement aux moments pertinents, discrets et synchronisés. Niveau cible de diffusion à mesurer et adapter au master ; cible de travail historique autour de **−14 à −16 LUFS**, plafond **≤ −1 dBTP**, sans promettre que tous les rushs peuvent l'atteindre sans dégradation. Ne pas altérer un master validé pour corriger une valeur qui ne crée aucun défaut audible.
5. **Sous-titres :** texte fidèle à la voix, timing vérifié au mot lorsque ce modèle le demande, pas de mots devinés, couleurs et contraste adaptés **au décor**, typographies distinctes par style, animations d'entrée/sortie propres. Chaque coche « ✓ », mot, case, bulle et flèche doit être **aligné et synchronisé** avec l'énoncé correspondant ; pas de « V » flottant au-dessus d'une phrase ou de seconde coche en retard.
6. **Format source respecté :** format **horizontal natif conservé en 16:9** sans bordures blanches/noires ajoutées ni recadrage vertical forcé ; vertical 9:16 conservé ; ne jamais couper un visage ou un texte essentiel. Rendre explicite la conversion de ratio si demandée. Sur horizontal natif, privilégier inserts graphiques légers et bulles plutôt que B-roll plein écran ; sur facecam verticale, **2 à 3 B-rolls maximum** lorsque narrativement utiles, et non comme quota obligatoire.
7. **DA premium / Apple-like :** effets cohérents, compositions équilibrées, hiérarchie typographique, cartes/bulles rondes sobres et centrées, tracking et animations réellement propres. Pas de blocs géants sans utilité, pas de doubles informations, pas d'éléments qui chevauchent le visage, les sous-titres ou les safe-zones Instagram/TikTok.
8. **Fluidité :** entrées/sorties animées, transitions motivées par l'idée, zooms justifiés, variations de cadrage selon contenu ; viser un évènement visuel pertinent environ toutes les quelques secondes **seulement si cela améliore la compréhension**, jamais un quota de mouvement.
9. **Tests réels :** export complet à partir de rushs bruts non vus lors de la conception, inspection image/audio et comparaison au master ; tests iPhone Safari et PC ; contrôle de décodage, export H.264/AAC et ratios d'origine, capacité mémoire/temps/coût ; pas de faux preview statique.
10. **Provenance / droits :** conserver la propriété et la traçabilité des éléments fournis, vérifier licences des musiques, polices, emojis, B-rolls et références tierces. S'inspirer d'un langage éditorial sans reproduire illégalement une œuvre protégée.

### H2 — Fiche modèle : Codie × OMNI (V60, unique Codie)

- **Promesse visuelle :** montage business/storytelling premium, **facecam principale**, angles argumentatifs, inserts visuels de preuves/exemples, textes éditoriaux ponctuels, transitions fluides et retenues. Pas d'effet « facecam + stickers collés ».
- **Rythme :** cuts propres motivés par les changements d'idée ; recadrages/punch-ins discrets, **2–4 ruptures narratives maximum selon rush** sans montage artificiellement frénétique.
- **B-roll :** **2 à 3 inserts pertinents maximum en vertical** ; sujets cohérents avec la parole, contextualisés. Le Pinterest/B-roll de référence ne constitue pas une licence de redistribution.
- **Sous-titres :** style éditorial moderne (référence Avenir dans les itérations), lisibles, centrés au bon endroit, animations maîtrisées ; appliquer le master si la police/licence/ressource est disponible, sinon un équivalent mesuré et validé.
- **Éléments graphiques :** bulles iOS rondes premium lors d'énumérations importantes, mots-clés et preuves ; animations d'entrée/sortie, effets sonores légers ; bulles **déclenchées par les paroles** et non par des intervalles arbitraires.
- **Audio :** voix d'origine, piste unique, aucun doublage, sound design discret.
- **À interdire :** cadres blancs permanents, gros overlays sans utilité, B-rolls aléatoires, zooms mécaniques, empilement de titres, transition gratuite.
- **Validation :** V60 = **référence créative** ; le moteur doit reproduire cette logique sur **au moins trois rushs différents** avant activation publique.

### H3 — Fiche modèle : Alex Hormozi × OMNI (référence V16)

- **Promesse visuelle :** facecam puissante, structure argumentative, **plein écran lorsque la narration l'exige**, gros mots-clés/chiffres/comparaisons, schémas animés explicatifs, grammaire dynamique mais intelligible.
- **Cadrage :** zooms/punch-ins ciblés selon argument et phrase ; ne pas écraser les visages, ni tronquer le ratio horizontal natif. Le **vertical** est prioritaire lorsque le rush est vertical.
- **Sous-titres :** gras, haut contraste adapté au décor, **mots animés en synchronisation avec la vraie transcription**, style propre à Hormozi ; aucun contenu fictif.
- **Motion :** progression visuelle dès les premières secondes, graphiques et animations qui expliquent réellement la phrase ; fluidité constante, illustration ponctuelle (preuves/équations/chiffres), pas une suite de miniatures statiques.
- **Sound :** coups de rythme et transitions légers, audio original strictement conservé ; aucune illustration ne doit apparaître **avant** les mots auxquels elle correspond.
- **À interdire :** animation absente malgré la promesse du modèle, miniature trompeuse, panneaux trop gros, décalage voix/image, perte de sous-titres.
- **Validation :** la référence V16 a été validée visuellement ; **la fidélité automatique complète, les sous-titres mot-à-mot et les exports multi-rushs restent à certifier**.

### H4 — Fiche modèle : Leila Hormozi (référence V53, priorité préservation)

- **Master créatif à ne pas dégrader :** **V53 conservée comme référence**, sous-titres mot-à-mot expressément approuvés ; montages/animations de référence acceptés. Ne pas reconstruire une V antérieure qui avait dégradé la cohérence.
- **Cuts :** environ **six cuts intelligents dans le master V53** selon historique ; détecter blancs et respirations/change d'idée, mais ne **pas** imposer exactement six cuts à tous les nouveaux rushs. Aucun cut gratuit ou phrase tronquée.
- **Composition :** se servir du **mur/décor** comme support graphique, intégrer les blocs dans l'espace, éviter le chevauchement visage/texte ; mini-tableau de points sur la **partie droite** du cadre quand narration pertinente.
- **Zooms :** rapides, propres et justifiés vers les zones énumérées (zoom de **la région droite**, pas seulement grossissement de la carte), puis retour au cadrage ; mouvements fluides, positionnement cohérent.
- **Énumérations :** affichage progressif d'étapes/points avec coches **✓** ; **chaque coche et chaque mot de la ligne exactement alignés** (verticalement et temporellement), centrage des libellés dans les cases, flèches orientées correctement. Ne pas répéter une ligne/étape « Compétence » ou « Prospection » sans motif narratif.
- **Sous-titres :** **mot à mot accepté dans V53** ; conserver ce mécanisme et recalculer leurs timecodes après chaque cut/zoom ; aucune lettre isolée ou « V » flottant, aucune superposition.
- **Audio :** piste originale, stable et synchronisée à toutes les coupes, animation/coche/B-roll alignés aux mots correspondants.
- **Style :** prémium, équilibré, animations data/texte, zooms utiles, design lisible sans effet générique.
- **Validation :** **version de référence utilisateur verrouillée**, avec mention historique « 100/100 » pour la **référence V53** ; cela **ne certifie pas** à soi seul la génération autonome ni la qualité sur d'autres rushs.

### H5 — Fiche modèle : Social Kinetic (référence V28)

- **Format de référence :** horizontal **16:9 natif**, plan large, éléments intégrés autour du sujet, sous-titres légers, mots/impacts visuels **verts**, bulles façon **iMessage bleues** apparaissant progressivement.
- **Narration et mouvement :** animations cinétiques motivées par des mots-clés, textes et chiffres très lisibles ; événements construits dans le temps ; ne pas poser tous les éléments dès le début.
- **Bulles :** uniquement quand une phrase importante est prononcée, pas « premier point/deuxième point » décoratifs. Références visuelles sur rush historique : « apprendre quelque chose », « prêtes à te payer », « gagner du temps », « gagner de l'argent » ; **leurs timestamps dépendent du rush de référence**, ne jamais les réutiliser sur une autre vidéo sans nouvel alignement.
- **Sous-titres :** position et style distincts des autres modèles, contenu exact et alignement aux paroles ; les anciens problèmes de synchronisation ne doivent pas réapparaître lors des exports automatisés.
- **Audio :** son original, sons iMessage/bulles synchronisés au déclenchement des animations et sans effet de doublage.
- **À interdire :** chevauchement bulles/sous-titres, retard des sons ou des textes, animation arbitraire, b-roll complet masquant inutilement une facecam horizontale.
- **Validation :** **Social Kinetic validé par l’utilisateur** (la référence de travail V28 doit être confrontée au master approuvé). Ne pas remettre en cause la validation créative ; certifier séparément le moteur autonome avec au moins trois exports sur de nouveaux rushs.

### H6 — Fiche direction complémentaire : Cinematic Storytelling

- **Objectif :** montage narratif cinématique et immersif, transitions souples, profondeur visuelle, mouvements de caméra légers et sound design atmosphérique, sans dénaturer l'original.
- **Ratio :** conserver le **16:9 horizontal natif** lorsqu'il existe.
- **Énumérations de l'itération travaillée :** un **unique panneau en haut à droite** contenant « Compétence / Offre / Prospection » avec coches lisibles, mots centrés et synchronisés aux énoncés. Ne **pas** ajouter un second affichage redondant du mot « Prospection », ni répéter « Compétence » inutilement.
- **Corrections historiques à préserver :** cadres assez grands, flèches correctement placées, alignements parfaits, absence de chevauchement, voix originale non détériorée ; raccourcir seulement les pauses inutiles et la fin silencieuse, sans bouleverser le design approuvé.
- **B-roll cinématique :** pertinent et rare ; s'il manque, **ne pas déclarer le résultat final**.
- **Validation V7 FINALE : approuvée par l’utilisateur le 22 octobre 2026. Le script de rendu Python + FFmpeg reproduit le master avec les fichiers sources annoncés. Ne pas exiger Hyperframes pour reproduire la V7 ; son prototype reste séparé. Les fichiers V7 (archive 38 Mo + script 25 Ko) ne sont pas matériellement présents dans le dossier de passation : les chercher, puis demander leur fourniture si absents. Référence créative validée, automatisation sur de nouveaux rushs encore à tester.**

### H7 — Fiche direction complémentaire : Apple Premium / Spatial UI

- **Signature :** UI spatiale haut de gamme, cartes iOS flottantes dans le décor, bulles arrondies, animations douces, profondeur et compositing crédibles, pas de grosses cartes plaquées au-dessus du visage.
- **Vidéos et références :** Apple Premium V4 et Spatial UI V1 servent de points de repère à rattacher au master ; **Apple Premium / Spatial UI a été confirmé par l’utilisateur**. Le statut de confirmation artistique est distinct des tests d’autonomie du moteur.
- **Contraintes :** pas de cartes sur le visage, profondeur/tracking cohérents, texte ajusté au décor, sous-titres fidèles synchronisés, sound design discret, format natif préservé.
- **Activation :** conserver la référence créative confirmée. Avant de proposer le traitement automatique aux clients, exécuter les tests de tracking, sous-titres, audio et rendu sur de nouveaux rushs ; une panne doit être signalée, jamais simulée.

### H8 — Architecture logicielle du système de modèles

- `studio_style_presets`: `style_id`, `display_name`, `status` (`reference_only`, `prototype`, `beta`, `production`), `version`, `aspect_rules`, `caption_rules`, `cut_policy`, `broll_policy`, `motion_policy`, `audio_policy`, `safe_zone_rules`, `reference_master_id`, `engine_adapter_id`, `licence_notes`, `published_at`.
- `studio_reference_assets`: `asset_id`, `style_id`, `reference_type` (`raw`, `approved_master`, `project`, `overlay`, `sound`, `audit`), `storage_ref`, `sha256`, `rights_status`, `source_date` ; **ne jamais inventer chemin, SHA ni nom de master absent**.
- `studio_jobs`: `job_id`, `user_id`, `style_id`, `style_version`, `source_id`, `media_hash`, `job_state`, `render_backend`, `started_at`, `completed_at`, `error_code`, `export_ref`.
- `studio_quality_audits`: `job_id`, `audio_integrity`, `transcript_alignment`, `overlay_collisions`, `cuts_narrative`, `format_integrity`, `export_decode`, `visual_review`, `passed_at`, `reviewer`.
- **Pipeline :** import → contrôle média → extraction de pistes → transcription/alignement vérifié → segmentation narrative → **décisions propres au modèle** → composition/animation → mixage piste originale + SFX → réassemblage en synchronisme → export complet → audit et livraison.
- **Chaque modèle a son adaptateur réel** (`engine_adapter_id`). Ne pas router tous les styles sur le même template avec de simples couleurs changées. Aucun score 100/100 automatique si les conditions de qualité ci-dessous n'ont pas été vérifiées.

### H9 — Conditions de publication d’un modèle (gates bloquants)

1. **Fidélité :** comparaison du rendu au master approuvé (layout, rythme, animations, style de sous-titres, comportement B-roll) ; pas seulement une miniature.
2. **Autonomie :** **au moins trois rushs différents, non utilisés pour concevoir le style**, traités de bout en bout sans intervention manuelle cachée ; documenter le ratio, la durée et l'origine de chacun.
3. **Son :** écoute réelle au casque + mesure des niveaux + absence de doublage/écho nouveau ; piste originale respectée.
4. **Sous-titres :** exactitude du texte et alignement temporel, vérifiés sur le rush ; pas de lettres isolées, mots incorrects, coches en retard.
5. **Temporalité :** effets déclenchés par le bon mot/argument ; aucun B-roll ou graphique révélant prématurément une phrase pas encore prononcée.
6. **Composition :** zéro chevauchement, pas de débordement des safe-zones, bulles/flèches/coches lisibles, visage respecté.
7. **Formats :** export décodable, test d'un horizontal natif et d'un vertical natif lorsqu'applicable, sans bandes ajoutées.
8. **Échec clair :** si moteur indisponible, transcription insuffisante, quota ou appareil limité, retourner une erreur utilisable ; **jamais** un faux fichier « monté » ou un bouton disponible qui ne fonctionne pas.
9. **Non-régression :** les fichiers maîtres approuvés (Codie V60, Leila V53 et autres références prouvées) demeurent **octet pour octet inchangés** en archive ; modifications dans une nouvelle version seulement.
10. **Statut visible exact :** `production` seulement après validation de ces gates ; `beta`/`prototype` tant que la reproduction autonome n'est pas démontrée.

## I. BILLING, ACCÈS GRATUITS ET ADMIN

### I1 — Droits d'accès, logique serveur

```
allow(user, feature, t) =
  is_active_owner(user) OR
  EXISTS active_nonrevoked_invitation_grant_entitling(feature, t)
  // futur seulement : OR EXISTS active_verified_paid_subscription_entitling(feature, t)
```

- Aucun prix, quota ou rôle transmis par le client ne fait foi.
- En V1 : un membre sans invitation valide voit l'écran connexion/activation et les pages légales ; **jamais de paywall ni d'accès au Studio/Stratégie**.
- Invitation gratuite : code secret haché en DB + `code_prefix` visible, limite temporelle et nombre d'utilisations ; redemption en transaction conditionnelle et idempotente, anti-bruteforce et audit.
- Si code 7 jours activé : période calculée à l'instant de **rédemption**, pas de création, sauf règle contraire explicitement signalée. Code permanent = sans expiration mais révocable.
- Code gratuit déjà utilisé par un compte => rédemption répétée idempotente sans prolongement involontaire. Multi-codes : définition claire de cumul (V1 : **pas de cumul** de cadeaux superposés ; l'accès le plus long valide s'applique sans générer une nouvelle durée artificielle).
- Paiement payant et cadeau simultané : l'union des droits détermine l'accès ; annulation abonnement n'annule pas automatiquement un cadeau encore valable.
- **Codes -100 %** : par défaut classe « réduction Stripe », pouvant avoir des conditions d'abonnement ; pour donner accès sans carte bancaire utiliser **invitation interne**, pas Checkout à 0 €.
- Ne pas autoriser un admin à se donner un rôle de propriétaire par l'UI utilisateur ; propriétaire initial provisionné via configuration serveur + procédure sécurisée.

### I2 — Stripe : FUTUR UNIQUEMENT (ne rien développer/activer en V1)

- Stripe Checkout via backend authentifié, liste de produits/prix autorisés côté serveur ; création Checkout avec `client_reference_id` lié à l'utilisateur.
- Webhook : vérifier `Stripe-Signature` sur **payload brut** et secret spécifique à environnement ; persister `event.id` unique ; rejouer sans effet secondaire ; reconstruire l'état à partir de l'objet Stripe concerné lorsque des événements arrivent hors ordre.
- Ne **jamais** considérer la redirection `success_url` comme preuve de paiement ; attendre webhook et/ou lecture Stripe sécurisée.
- États : trialing, active, past_due, unpaid, canceled, incomplete; règles d'accès et délai de grâce **configurables** (V1 : accès actifs pour `active` ou `trialing` réellement confirmé; `past_due` sans accès sauf délai explicite administré; jamais accord permanent implicite).
- Customer Portal/résiliation facile, confirmation des échéances, des conditions de renouvellement et du prix final avant paiement.
- Promotions Stripe : pourcentage/montant, usage unique ou durable selon capacité officielle ; validations côté serveur ; afficher une facture et prix final cohérents.
- Revue juridique FR : CGV, mention prix TTC et taxes, droit de rétractation/exception éventuelle, résiliation accessible en ligne, confidentialité/RGPD avant commercialisation.

### I3 — Événements admin audités

- Create/update/revoke promo, gift, price, method, user access => journal d'audit propriétaire + date + justification facultative.
- Vérifier MFA propriétaire, rôle `owner` à chaque route, CSRF/session, rate limits, anti-enumération, masquage de données personnelles dans les listings.

## J. ENDPOINTS API (SCHÉMA FONCTIONNEL, PAS CODE DÉPLOYÉ)

Routes JSON, authentification obligatoire hors `auth/*`, `pricing`, `stripe/webhook`. Chaque action multi-tenant vérifie l'ownership.

- `GET /api/me` ; `GET /api/entitlements` ; `POST /api/auth/*` selon fournisseur.
- `GET/PUT /api/profile`; `POST /api/imports/preview`; `POST /api/imports/commit`; `GET /api/imports/{id}/errors`.
- `GET /api/content`; `POST /api/content`; `GET /api/metrics?period=&platform=&format=`.
- `POST /api/diagnostics` (entrée `{goal, profile_id, observation_window, engine_version}`), `GET /api/diagnostics/{id}` ; idempotent par hash si mêmes entrées.
- `GET /api/methods`; `GET /api/methods/{id}` (version publiée uniquement).
- `GET /api/missions`; `PATCH /api/missions/{id}/steps/{stepId}` ; `POST /api/experiments`; `POST /api/experiments/{id}/results`.
- `POST /api/video/preflight` (métadonnées et capacités) ; `POST /api/video/analyses` (caractéristiques validées, pas upload obligatoire) ; `GET /api/video/analyses/{id}`.
- Routes billing (`/api/billing/*`) : **hors périmètre de V1** ; aucune route active ni offre publique.
- `POST /api/gifts/redeem` (login requis, validation transactionnelle).
- `GET /api/admin/members`; `POST /api/admin/invites/email`; `GET/POST/PATCH /api/admin/gift-codes`; `POST /api/admin/grants/{id}/revoke`; `GET /api/admin/feedback`; `PATCH /api/admin/feedback/{id}`; `GET/POST/PATCH /api/admin/faq`; `GET/POST/PATCH /api/admin/method-versions`; `GET /api/admin/audit-log`. Tous vérifient propriétaire serveur.
- `GET /api/faq` (publique ou utilisateur selon choix) ; `POST /api/feedback` (connecté + anti-spam + taille limitée) ; `GET /api/privacy/{kind}` ; `GET /api/support` ou formulaire de contact.
- `GET/POST/PATCH /api/admin/promo-codes` : **future commercialisation**, indisponible en V1.
- `GET /api/privacy/export`; `POST /api/privacy/delete-request` avec validation forte.

Erreurs structurées `{code,message,retryable,missing_fields?,trace_id}` ; messages utilisateur courts et compréhensibles. Aucun endpoint admin accessible sans permission serveur.

## K. PHASES D'IMPLÉMENTATION (CODEX / WORK)

**P0 – Reconnaissance et sauvegarde (bloquant) :** retrouver projet Social+ existant, audit framework, dépôts/branches/env/secrets, Studio audio-vidéo, coûts, tests, plans de rollback ; branch de travail isolée ; **ne jamais modifier production en premier**.

**P1 – Accès privé + sécurité :** authentification sur invitation, rôle propriétaire unique, MFA admin, table grants/codes, invitations e-mail, journal des actions, isolation multi-utilisateur, gestion d'expiration/révocation. **Aucun paywall ni Stripe**.

**P2 – Stratégie minimale réellement utile :** profil/objectifs, import CSV/saisie, calculs fiables, 12 fiches et missions déterministes, historique.

**P3 – Diagnostic avancé :** priorité et confiance, analyse niche/concurrents accessible, expériences et postpublication ; données insuffisantes visibles.

**P4 – Vidéo prépublication :** upload local fiable, préflight iPhone/PC, score éditorial conditionnel, timestamps, recommandations reproductibles, fallback manuel.

**P5 – Régression Studio :** intégrer la totalité du **catalogue H** sans recréer des doublons ; préserver tous les masters, valider chaque style (au moins 3 rushs inconnus/style), synchronisation audio/vidéo/overlays, sous-titres mot à mot lorsque spécifiés et exports ; ne pas marquer « terminé » avant les gates H10.

**P6 – Automatisations facultatives :** connexion officielle Instagram/TikTok uniquement après permissions et tests de sécurité. Aucune dépendance au scraping.

**P7 – Préproduction et accès équipes :** audits sécurité/performance, restauration DB, CGU/mentions légales/confidentialité, tests d'invitation et d'effacement, FAQ, formulaire avis/support, monitoring des quotas et rollback. **Aucun achat réel ni Stripe.**

**P8 – Commercialisation future (hors V1, nouveau feu vert explicite) :** prix, Stripe, abonnements, codes de réduction, CGV, obligations fiscales, tests de paiement/renouvellement/résiliation. Ne pas développer P8 sans demande.

## L. TESTS D'ACCEPTATION — BLOQUANTS

Référence détaillée : `SOCIAL_PLUS_V18_TESTS.json`.

Catégories de test :

1. **Identité produit** : marque Social+ et 3 onglets visibles Accueil/Montage/Stratégie ; Studio demeure un nom technique interne ; aucun menu Clip+/Edit+/Viral+.
2. **Données** : chiffres faux, champs absents, denominators zéro, import CSV répété, séries hors période, compte non autorisé.
3. **Diagnostic** : reproductibilité, divergence de priorité selon objectif, méthode désactivée, maximum trois missions, aucune attribution causale abusive.
4. **Vidéos** : mêmes entrées = score identique ; audio original, timestamps, sous-titres, qualité d'export, limitations Safari iOS.
5. **Paiement FUTUR** : tous les tests Stripe marqués différés et non bloquants **pour la V1 privée** ; avant commercialisation ils redeviennent bloquants. Aucun paiement possible pendant la V1.
6. **Invitations** : activation sans carte, expiration exacte, permanent/révocation, code expiré/invalide, quota concurrent, rejeu même utilisateur.
7. **Admin** : propriétaire unique ; utilisateur lambda jamais admin ; XSS/CSRF, MFA, journal, invitation directe/code, expiration et révocation. Une invitation ne doit jamais donner accès aux données d'un autre membre.
8. **Dégradation gracieuse** : AI quota épuisé, D1 quota épuisé (erreur claire, pas résultat faux), hors ligne, fichier local trop lourd.
9. **Compatibilité** : Safari iPhone, Chrome PC, formats vidéo sources, portrait/paysage, safe-zone.
10. **Conformité** : retrait consentement, export, suppression, sauvegarde, résiliation et informations précontractuelles.

**Critère de sortie** : chaque test bloquant passe réellement sur preview/staging ; preuves d'exécution (logs, captures, résultat) ; aucun test simplement coché manuellement sans mesure ; aucune fonctionnalité factice ni score décoratif.

## M. RISQUES, DÉCISIONS ET LIMITES

| Risque | Traitement | État |
|---|---|---|
| Studio nécessite serveur de rendu | Inventaire, mesurer CPU/durée/coût, conserver backend existant ou choisir autre solution réelle | Audit nécessaire |
| Workers Free atteint limites | Limiter l'usage, calculs client, cache, indicateurs, erreurs explicites, pas d'achat auto | Compatible prototype limité |
| D1 5 Go total mais 500 Mo par base | Conserver uniquement métriques/textes ; pas de vidéo brute en DB ; pagination/archive | À mesurer |
| IA à 0 € non illimitée | Rules engine autonome, IA facultative et quotas | Design retenu |
| API Meta/TikTok limitées | Saisie/CSV + consentement ; OAuth officiel ensuite | Design retenu |
| Codes promo sensibles au brute force | Codes aléatoires hachés, anti-rate limit, usage atomique | Exigence |
| Utilisateur paie mais Stripe webhook retardé | État « activation en cours », synchronisation serveur et retry | Exigence |
| Contenus Hormozi protégés | Référencer méthodes et liens, reformuler, ne pas revendre des transcriptions intégrales | Exigence |
| Règles FR SaaS payant | Revue CGV/retractation/résiliation/RGPD et fiscalité | À faire avant vente |

## N. SOURCES PRIMAIRES ET DATES DE VÉRIFICATION

Vérifiées le 21 octobre 2026 :

- Cloudflare Workers limits : https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 pricing : https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare D1 limits : https://developers.cloudflare.com/d1/platform/limits/
- Workers AI pricing : https://developers.cloudflare.com/workers-ai/platform/pricing/
- Stripe France tarifs : https://stripe.com/fr/pricing
- Stripe Billing à l'utilisation : https://stripe.com/fr/billing/pricing
- Stripe coupons : https://docs.stripe.com/api/coupons/create
- TikTok Display API : https://developers.tiktok.com/docs/en/display-api-overview
- TikTok autorisations : https://developers.tiktok.com/docs/en/display-api-get-started
- YouTube Video API : https://developers.google.com/youtube/data/reference/rest/v3/videos
- Résiliation en ligne France (DGCCRF) : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/le-contrat-un-accord-entre-des-parties-bien-informees-au-prealable
- Ressources Hormozi : https://www.acquisition.com/leads-gifts
- Instagram bonnes pratiques : https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/

Les seuils du moteur Social+ sont **des choix internes**, pas des règles secrètes des plateformes. Toute adaptation de source doit être versionnée et réexaminée si la plateforme modifie ses indicateurs.

## O. PROMPT DE PASSATION À COLLER DANS CODEX / WORK (V1 PRIVÉE)

> Lis **intégralement** `SOCIAL_PLUS_V18_CAHIER_DES_CHARGES.md` et `SOCIAL_PLUS_V18_TESTS.json` ; la **V18 prévaut sur V17 et versions antérieures**. Reprends le dépôt et l'hébergement **existants**, crée une branche isolée et audite d'abord les différences entre branches / masters et production. Livrer **un site responsive qui ressemble à une vraie application iOS Apple premium**, pas une application native : trois onglets **Accueil, Montage, Stratégie**, compte et aide via l'avatar. **V1 PRIVÉE, SANS PAIMENT :** propriétaire ADMIN unique (rôle côté serveur, MFA), invitations gratuites e-mail ou codes individuels, 7 jours/30 jours/permanent, révocation et quotas, accès aux teams sans carte ni Stripe. Ne montrer aucun prix, checkout, paywall ou abonnement ; ne pas coder une infrastructure de vente. Ajouter FAQ éditable par le propriétaire, avis privés avec accord séparé pour éventuelle publication, support, confidentialité, mentions légales, CGU, gestion des données et consentement cookies seulement si traceurs non essentiels. Préserver le catalogue retenu : Codie × OMNI V60, Alex Hormozi, Leila V53, Social Kinetic V28, Apple Premium/Spatial UI validés, Cinematic Storytelling V7 finale validée artistiquement (Python + FFmpeg), sources à localiser, sans anciens presets. Moteur Stratégie réel, déterministe, sources et données vérifiables, aucun faux score. Ne pas supposer que validations visuelles prouvent la qualité automatique. Exécuter en staging les tests V18 applicables, démontrer sur iPhone et PC, distinguer échecs de tests différés. Aucun abonnement payant de service, aucun déploiement production risqué sans accord explicite.

---
**Statut V18 : spécification V1 privée gratuite, propriétaire seul ADMIN, Stripe et commercialisation reportés. Aucune modification du code ni certification de rendu automatique par ce document.**

## P. MODULES OBLIGATOIRES V1 — ADMIN, FAQ, AVIS, LÉGAL (ARBITRAGE V17)

### P1. ADMIN propriétaire unique
- L'administrateur est **le propriétaire uniquement**, provisionné par identifiant serveur vérifié, avec MFA ; impossible de se promouvoir avec un cookie, un code, un en-tête, l'UI ou une requête.
- Espace `/admin` protégé serveur : tableau de bord membres / invitations / accès expirants / erreurs / feedback / FAQ / méthodes ; **pas de revenu, prix, réductions ou billing en V1**.
- Attribution directe à un e-mail vérifié ou génération de code gratuit à usage unique par défaut ; expiration du code distincte de la durée d'accès accordée (7/30 jours ou permanent) ; activation atomique, limitée, journalisée.
- Gestion des équipes : champ équipe facultatif, filtres par équipe, vues agrégées d'utilisation **sans lecture des vidéos privées, textes de stratégie ou données de performance individuelles sans base légale et nécessité** ; un membre n'accède jamais aux fichiers des autres.
- Protection : limites de tentatives, logs sans secrets, désactivation de comptes, révocation instantanée, sauvegarde/récupération. Aucun mail envoyé automatiquement sans consentement du propriétaire au canal d'invitation ; si prestataire email payant indisponible, lien/code à partager manuellement.

### P2. FAQ
- Rubrique FAQ depuis Compte/Aide, accessible également depuis login pour les questions d'accès ; catégories « Premiers pas », « Montage », « Stratégie », « Mes données », « Problèmes techniques » ; recherche simple et accordéons natifs.
- Questions et réponses éditables/publiables/archivables par propriétaire ; aucune fausse fonctionnalité revendiquée, aucun prix ou abonnement actif mentionné en V1.


### P2.1. FAQ initiale — réponses factuelles à afficher après implémentation réelle
- « Comment accéder à Social+ ? » — « Avec une invitation personnelle de l'administrateur. »
- « L'accès est-il payant ? » — « Non, pendant cette phase privée. Aucun moyen de paiement demandé. »
- « Comment commencer un montage ? » — « Ouvrez Montage, importez un rush, sélectionnez un modèle disponible et suivez les étapes. » **Afficher cette réponse seulement quand l'import et le rendu fonctionnent réellement.**
- « Où consulter mes analyses ? » — « Dans Stratégie, avec les données que vous avez renseignées ou importées. »
- « Puis-je signaler un problème ? » — « Oui, dans Compte → Donner mon avis → Signaler un problème. »
- « Comment supprimer mes données ? » — « Dans Compte → Confidentialité, demandez l'export ou la suppression selon les options disponibles. »
- Réviser ces réponses après les tests, ne jamais annoncer une fonction indisponible.

### P3. Donner mon avis et support
- Depuis Compte/Aide : formulaire simple **Note facultative 1–5 + catégorie (Avis / Idée / Signaler un problème) + commentaire**. Identité liée au compte de manière interne ; pas de publication publique par défaut.
- L'admin voit les retours, leur date, leur statut `nouveau / en cours / résolu` et peut répondre ou classer ; notification au créateur uniquement si canal sécurisé existant.
- **Publication d'un témoignage : accord positif séparé, documenté, révocable**, relecture du texte affiché avant publication ; aucun avis fictif ou transformé en promesse commerciale. Réduire l'exposition de données personnelles, limiter longueur/pièces jointes, modérer et limiter spam.
- Contact support visible depuis la connexion et Compte ; message d'erreur technique avec trace ID, sans données de vidéo ou identifiants secrets.

### P4. Confidentialité et documents légaux avant accès à l'équipe
- Pages lisibles sur mobile, accessibles hors connexion, **Politique de confidentialité**, **Mentions légales**, **CGU**, **Cookies/préférences** si applicable ; lien permanent depuis Compte/Aide et écran de connexion.
- Politique : éditeur réel et contact, traitement des comptes / rushs vidéos / diagnostics / statistiques / feedback, finalités et bases juridiques, catégories de destinataires/sous-traitants, durée ou critères de conservation, sécurité, éventuels transferts hors EEE, droits d'accès/rectification/effacement/opposition/portabilité selon cas, procédure d'exercice et CNIL. **Ne pas inventer les coordonnées juridiques ou durées** ; propriétaire complète les données avant ouverture aux équipes.
- Minimiser les données collectées ; ne pas conserver les rushs bruts sans besoin et règle claire, ne pas les utiliser pour entraîner un modèle sans base appropriée ; par défaut stocker uniquement ce que le service nécessite et appliquer droits par `user_id`. Export et suppression de compte avec vérification et exceptions de conservation légale documentées.
- Cookies strictement nécessaires à connexion/sécurité peuvent relever d'exemption de consentement ; analytics publicitaires et autres traceurs non essentiels demandent un consentement préalable, paramétrable et révocable, **sans installer de bannière trompeuse si aucun traceur soumis à consentement**.
- **Aucune vente en V1** : les CGV et la rétractation payante restent à préparer **avant** la commercialisation, pas à simuler. Les mentions légales d'un site professionnel et l'information RGPD sont pertinentes même en phase d'invitation gratuite.
- Pages et paramètres rédigés clairement en français ; versionner les CGU/politiques et dater les changements importants.

### P5. Architecture de navigation V1 (design approuvé)
- Barre iPhone à **3 onglets seulement : Accueil · Montage · Stratégie** ; pas de quatrième onglet pour l'admin/FAQ/avis/stats. Paramètres via avatar, ADMIN visible uniquement pour le propriétaire authentifié.
- Style premium inspiré d'Apple : surfaces graphite, contrastes impeccables, typographie soignée, grands previews vidéo, miniatures réelles, Liquid Glass discret pour la navigation, transitions fluides, vrai mode clair/sombre ; pas de chiffres marketing ni de données factices.
- Les pages doivent être de vrais écrans web accessibles et performants sur Safari iPhone et PC ; si PWA ajoutée, c'est un plus, pas une obligation de distribution App Store.

### P6. Sources juridiques contrôlées au 21/10/2026
- https://entreprendre.service-public.gouv.fr/vosdroits/F23266 — déclaration de chiffre d'affaires micro, périodicité.
- https://entreprendre.service-public.gouv.fr/vosdroits/F37353 — recettes encaissées, cotisations.
- https://entreprendre.service-public.gouv.fr/vosdroits/F31228 — mentions légales d'une entreprise individuelle.
- https://www.cnil.fr/fr/rgpd-en-pratique-communiquer-en-ligne — formulaires et cookies.
- https://www.cnil.fr/fr/rgpd-les-premieres-etapes — informations et droits RGPD.
- https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles — traceurs et consentement.

## Q. LISTE DE PRÉ-LANCEMENT V1 (BLOQUANTE)

1. Routes admin testées contre membre lambda et utilisateur non connecté, MFA propriétaire actif, aucune fonction admin depuis client.
2. Invitations e-mail/code, limite d'usage, expiration et révocation validées en vrai ; accès gratuit fonctionne sans Stripe.
3. Navigation Apple-style responsive (Safari iPhone/PC), aucun faux état ni bouton factice.
4. FAQ alimentée par contenu exact, édition par le propriétaire fonctionnelle.
5. Avis et bugs soumis, stockés et consultables en privé par le propriétaire ; aucune publication sans consentement.
6. Mentions légales + confidentialité + CGU disponibles à l'inscription et dans Compte, coordonnées juridiques réelles renseignées, choix cookies conforme aux traceurs réellement utilisés.
7. Suppression/export de données utilisateurs testés et suppression des données vidéo selon rétention déclarée.
8. Préserver les sources de tous les modèles validés ; tout modèle non opérationnel explicitement indisponible, jamais présenté comme prêt.
9. Pas d'appel Stripe ni d'encaissement; les tests `BILLING-*`, `STRIPE-*`, `PROMO-PAID-*` sont différés avant lancement commercial.


## R. PASSATION CODEX V18 — EXÉCUTION ET GATES DE LIVRAISON

- **Ordre :** consulter `CODEX_SOCIAL_PLUS_EXECUTION.md` en premier, puis ce cahier intégralement et `SOCIAL_PLUS_V18_TESTS.json`. Faire inventaire de toutes les branches (pas seulement `main`), masters et moteurs existants ; établir un tableau trouvé / absent / fonctionnel / non testé et traçabilité.
- **Objectif utilisateur :** livraison d'une V1 réellement navigable, exploitable sur iPhone Safari et PC, et d'une preview fonctionnelle en branche isolée ; aucune réécriture inutile de l'existant.
- **Approche anti-crédits :** commits progressifs testés, ne pas refaire inutilement les 6 moteurs, arrêter toute implémentation qui réclame un artefact source manquant et poursuivre les modules indépendants ; documenter ce blocage plutôt que d'inventer.
- **Interdiction :** faux upload, faux rendu, faux analytics, faux score de viralité, fausse FAQ, fausses statistiques, compte admin exposé, stockage inter-utilisateur accessible, faux raccordement Meta/TikTok.
- **Sortie attendue :** code versionné, fichiers `.env.example` sans secrets, migrations DB réversibles, README Windows/PC, interface mobile et desktop, tests automatisés exécutés, captures écran, démonstration de flux d'usage et liste exhaustive des limites / services payants / sources manquantes.
- **Aucun lancement commercial ni déploiement production** sans approbation expresse.