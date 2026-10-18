# Edit+ — modèle Social Kinetic V28 intégré (staging)
18 octobre 2026 · Branche : `editplus-integrate-social-kinetic-v28-20261018`

## Architecture modifiée
- **Modèle :** identifiant stable et versionné `social_kinetic_v28` ajouté à `EDIT_STYLES` ; Social Kinetic historique inchangé.
- **API Edge :** `GET /viral-edit-jobs/edit/models` retourne l'entrée V28, son statut et ses prérequis. `POST /viral-edit-jobs/edit` accepte `style:"social_kinetic_v28"` uniquement si `ENABLE_SOCIAL_KINETIC_V28=staging` sur l'Edge API. Stocke `edit_projects.style = social_kinetic` (style historique) et `settings.model_variant = v28_verified_speech` ; le payload du job conserve `style = social_kinetic_v28`.
- **Worker :** route sélection V28 vers `social-kinetic-v28-engine.js` et `social-kinetic-v28-runtime.js`, sans fallback silencieux vers le modèle historique.
- **Moteur :** les mots viennent de `analysis.transcript.words` avec preuve de timecodes de fournisseur `gemini_interactions_word_info`, et le placement vient d'échantillons indépendants `frameProof`. Les textes absents de la vidéo ne sont pas ajoutés. Collisions inter-éléments vérifiées ; une incrustation non prouvée est refusée.
- **Direction artistique :** blancs V16, vert `#2E5F34`, bulles iOS `#0C63BC`, vidéo au format natif, aucun montant inventé. La timeline spécifique du rush de démonstration de 41,1 s n'est **jamais** copiée sur un client.
- **Rendu :** vrai HyperFrames / GSAP, incrustation sur le rush monté, première piste audio de la vidéo recopiée, inspection FFmpeg avant exposition de l'export.

## Vérifications réalisées
Le workflow GitHub `editplus-v28-integration.yml` valide la déclaration du modèle, les preuves de parole, le refus en absence de zones sûres, les montants non prononcés et un rendu réel du HTML généré par la nouvelle logique. La vidéo V28 d'origine, approuvée par l'utilisateur, reste le prototype artistique.

## Ce qui n'est PAS activé
- Le modèle **n'est pas déployé dans l'interface publique Edit+**. Le dépôt contient surtout le moteur, l'API et un prototype indépendant `viral-edit` qui n'est pas le parcours d'export HyperFrames : y ajouter une carte laisserait croire à un rendu fonctionnel alors qu'il ne le serait pas.
- Le worker attend des preuves de zones visage/mains (`analysis.socialKineticV28.frameProof` ou `analysis.socialKineticV10.frameProof`). Si le pipeline d'analyse ne les fournit pas, il arrête le job avec un code de preuve explicite. Un générateur automatique indépendant de ces preuves reste à raccorder.
- L'alignement acoustique mot par mot de toutes les vidéos futures, les effets sonores par événement et les **3 tests UI → API → worker → export MP4** ne sont pas encore certifiés.
- Les deux flags doivent être configurés côté Edge API et worker pour les essais autorisés : `ENABLE_SOCIAL_KINETIC_V28=staging`, et `ENABLE_HYPERFRAMES_RENDER=true` pour le worker. Ne pas activer en production sans ces preuves.
- Le schéma SQL historique du dépôt n'autorise pas `social_kinetic` dans les CHECK de `edit_projects.style` et `caption_preset`. Vérifier le schéma réel de la **bonne base Viral Studio** avant activation. Ne pas appliquer de migration sur un projet Supabase étranger.

## Contrôle d'acceptation avant lancement public
1. L'interface Edit+ doit montrer V28 et envoyer exactement `style:"social_kinetic_v28"`.
2. Un upload de nouvelle vidéo avec paroles alignées et frameProof aboutit à un vrai MP4 natif (pas la démonstration figée).
3. Sans mot certifié ou sans masque indépendant visage/mains, message clair et aucun export faux.
4. Trois rushes très différents exportés avec review artistique humaine et comparaison des sous-titres/audio.
5. Après résultat concluant, activer le modèle sur le **bon environnement** uniquement et fermer la PR.

Statut : **intégré et rendu technique prouvé sur échantillon contrôlé ; staging, pas encore commercial/public.**
