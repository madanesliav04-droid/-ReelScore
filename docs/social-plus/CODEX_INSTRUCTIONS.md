# Social+ — ORDRE CODEX / V18 (22 octobre 2026)

**Exécute l'implémentation à partir de l'existant, sans redémarrer le produit à zéro.**

## Première lecture obligatoire
- `docs/social-plus/SOCIAL_PLUS_V18_CAHIER_DES_CHARGES.md` — lire TOUTES les sections A à R.
- `docs/social-plus/SOCIAL_PLUS_V18_TESTS.json` — **97 scénarios**, non exécutés; six scénarios Stripe différés V1.
- Répertoire existant `madanesliav04-droid/-ReelScore`, toutes ses branches, pas seulement `main`.

## Décisions verrouillées
1. **Social+** est une SEULE marque publique. Ni Edit+, ni Viral+, ni Clip+ ni nouveaux sous-noms marketing dans l'application.
2. **SITE WEB responsive au format vraie application iOS Apple premium**, PAS application native SwiftUI ni App Store maintenant. Safari iPhone prioritaire, Chrome PC indispensable. Design graphite, Liquid Glass discret, typographie premium, mode clair/sombre, animations fluides, contenu lisible; visuels réels, aucun chiffre inventé.
3. Navigation : **Accueil / Montage / Stratégie**. Statistiques dans Stratégie, FAQ/avis/support/compte/confidentialité via avatar, admin en route privée.
4. **V1 privée gratuite exclusivement sur invitation**. Aucun Stripe, abonnement, checkout, tarifs, publicité, carte bancaire, CGV de vente ou paywall.
5. **ADMIN propriétaire unique**, rôle imposé en backend + MFA. Gestion des équipes, invitation e-mail ou code privé 7 jours/30 jours/permanent, révocation immédiate, quotas, statuts, FAQ/méthodes éditables, avis privés, journal sans secrets. Un membre n'accède jamais aux données d'un autre.
6. **Confidentialité** : CGU, mentions légales et politique RGPD réelles, lien avant connexion, export/suppression données, cookies seulement si pertinents, coordonnées juridiques non inventées. Feedback privé, publication de témoignage seulement sur accord explicite distinct.

## Montage — six modèles visuellement approuvés
Ne JAMAIS remplacer un moteur réel par une maquette de rendu; statuts beta/reference_only jusqu'aux vrais tests :
- **Codie × OMNI V60** — `EDITPLUS_V60_FINITION_OMNI.mp4` et `EDITPLUS_V60_FINITION_PACK_QA.zip` avec `build_v60.py`.
- **Alex Hormozi × OMNI V16** — archive `EDITPLUS_HORMOZI_V16_RETOUR_V11_PACK.zip`; branche `editplus-alex-reference-lock-20261017`, `apps/worker/src/hormozi-omni-director.js`, `hormozi-omni-render.js`, `hormozi-beat-timing.js`. Autre candidat `editplus-alex-v8-release-candidate-20261017`; comparer.
- **Leila Hormozi V53** — `EDITPLUS_LEILA_MODELE_3_V53_SOURCE_ET_AUDIT.zip`, `render_leila_v53.py`.
- **Social Kinetic V28** — branche `editplus-integrate-social-kinetic-v28-20261018` : `apps/worker/src/social-kinetic-v28-engine.js`, `social-kinetic-v28-runtime.js`, tests V28; staging flags Hyperframes, pas encore preuve d'autonomie.
- **Apple Premium / Spatial UI** — packages Apple Premium V4/V5 et `EDITPLUS_MODELE05_V10_CODE.zip`; vérifier quel master est approuvé.
- **Cinematic Storytelling V7 FINALE** — validée par l'utilisateur le 22/10/2026, **Python + FFmpeg**, pack annoncé **38 Mo** + script sans média **25 Ko**, rush original, timings et réglages. Hyperframes SEULEMENT prototype séparé (non utilisé pour V7). **Fichiers V7 non présents dans ce dépôt de passation, à localiser puis demander s'ils manquent; ne jamais inventer le master ou prétendre que V7 Hyperframes est le rendu approuvé.**

Le moteur doit préserver la voix originale unique, la sync au mot, les cuts narratifs, le ratio natif horizontal/vertical sans bandes, les safe zones, l'absence de chevauchement, les animations pertinentes et les exports MP4 H.264/AAC. Adapter le nombre d'inserts au contenu (pas de B-roll artificiel). Tester chaque modèle sur au moins trois nouveaux rushs AVANT de déclarer « production ». N'utiliser aucune preuve inventée ni asset tiers sans droits.

## Stratégie (ex Viral+) — fonctionnel, pas décoratif
Audits profil, bio, positionnement, niche/objectifs, historique performances depuis CSV/saisie manuelle ou API autorisées, concurrence, 12 méthodes pédagogiques, au plus 3 missions prioritaires, analyse vidéo prépublication avec timestamps observables, sous-scores reproductibles et recommandations hook/rétention/CTA/rythme/structure. Même fichier + contexte + version = même score, sinon expliquer pourquoi. Il s'agit d'un score de préparation éditoriale, jamais d'une prédiction de viralité. Les données non observables s'affichent « non disponible »; sans API autorisée, ne prétendre à aucune donnée Instagram en temps réel.

## Exécution économisant les crédits
**0. AUDIT en lecture seule :** identifier frontend, API, DB, branche effectivement déployée, chemins sources et dépendances des six styles; comparer l'existant. Rédiger inventaire trouvé/manquant, coûts/risques. La branche de worker Railway était `socialplus-auth-same-origin-20261019` lors de l'ancien inventaire; revérifier, ne jamais modifier production en aveugle.
**1. PR isolée :** créer branche de travail séparée; interface Apple Pro utilisable et vraie auth privée. Aucun nouveau service payant.
**2. Backoffice :** ADMIN, invitations gratuites, sécurité multi-tenant/MFA, FAQ, avis et pages légales.
**3. Stratégie :** reconnecter moteur réel, stockage source/timestamp, CSV, pédagogie et tests reproductibilité.
**4. Montage :** réintégrer pipelines existants, vrai import/job/rendu/preview/export; six adaptateurs distincts, source originale V7 indispensable pour fidélité Cinematic.
**5. TESTS :** exécuter les 97 scénarios applicables; marquer honnêtement pass/fail/not-run/deferred; essais Safari iPhone et PC, upload réel et vérifications audio, vidéo, codecs, quotas; capture écran et rapport.
Si une source manque, rendre le reste fonctionnel et documenter précisément le blocage; ne pas le masquer sous une fausse fonctionnalité.

## Sécurité et limites de mission
- Aucun merge sur main, aucun déploiement production, aucune migration destructive, aucun achat, aucune modification de clés/config/secrets/domaine sans accord propriétaire.
- Ne pas migrer aveuglément Supabase/Railway/Cloudflare. Les moteurs FFmpeg lourds ne doivent pas être exécutés sur un Workers Free CPU-limité sans test.
- Donner : code en commits, PR, aperçu staging si disponible gratuitement, captures iPhone/PC, vrais tests exécutés, guide local Windows et `.env.example`, liste des fichiers manquants et des coûts éventuels.
- **Ne pas rendre un screenshot en guise d'application.** L'objectif est une V1 réellement utilisable.

**Commence par lire intégralement le cahier V18 et inspecter le code existant. Ensuite exécute par petits lots testables sans reposer les choix de produit déjà tranchés.**
