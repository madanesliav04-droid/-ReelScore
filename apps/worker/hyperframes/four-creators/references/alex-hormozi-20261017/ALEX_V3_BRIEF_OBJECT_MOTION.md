# EDIT+ — ALEX HORMOZI V3
## Brief maître HyperFrames : montage explicatif avec objets animés
Version 3.0 — 17 octobre 2026 · STAGING / non validé commercialement

### 1. MISSION
Nous ne voulons ni un simple montage de sous-titres ni des slides répétitives. Le résultat doit se rapprocher **du langage de montage des trois vidéos Alex fournies**, de bout en bout : facecam, cuts pertinents, démonstrations visuelles, objets explicatifs, graphiques et narration fluide.

**Promesse : une notion abstraite devient visible et immédiatement compréhensible.**
La qualité du raisonnement compte davantage que le nombre d'effets. Ne pas reproduire à l'identique des plans ou assets protégés de créateurs tiers.

### 2. RÉFÉRENCES PRIORITAIRES
Lire d'abord `AGENT.md`, `MODEL_RULES.md`, `REFERENCE_SHOTS.md` et `MODEL_OVERRIDES.json` dans ce dossier. Inspecter les 3 clips utilisateur **privés** si l'agent y a réellement accès. Sinon utiliser uniquement les observations documentées et signaler la limite. Le dernier corpus Alex remplace l'ancien modèle beige : **marine sombre + blanc cassé + jaune sélectif**.

### 3. NOUVELLE SIGNATURE V3 : OBJECT MOTION
En plus des infographies, créer de **vrais objets graphiques animés**, en SVG, CSS, Canvas ou modèles/visuels 2.5D compatibles HyperFrames — pas des photos génériques.

Types autorisés lorsqu'ils apportent une compréhension vérifiable :
- **Objets concrets :** produit, pièce, billet stylisé, boîte, document, téléphone générique, ordinateur, calendrier, vitrine, personne en pictogramme ; liés à une phrase réellement dite.
- **Mécanismes :** objets qui se déplacent, se connectent, se regroupent ou se séparent pour montrer cause → effet, problème → solution, entrée → processus → résultat.
- **Business frameworks :** organigrammes, flux entre acteurs, funnels, cartes de concepts, tableaux comparatifs, étapes révélées successivement.
- **Preuves :** graphiques uniquement à partir de chiffres sourcés, captures authentiques avec droits, interfaces simplifiées et explicitement illustratives.
- **Visualisations abstraites :** flux, blocs, pièces d'un système, métaphores pédagogiques clairement non factuelles.

Un « objet animé » doit **montrer un mécanisme**, pas décorer un écran. Éviter les icônes qui flottent sans raison, les emojis et le stock « business ».

### 4. GRAMMAIRE VISUELLE
- Canvas navy profond (#121826 / #17202D indicatifs), contraste lisible ; titrages blanc cassé et jaune sur mots vraiment importants.
- Scènes pédagogiques **plein écran**, pas de petites cartes dans une colonne.
- Objets avec formes cohérentes, volume subtil, lumière/ombre discrète, proportions propres, pas de plastique brillant, pas de 3D gadget.
- Animations en **séquence causale** : objet A apparaît → action / liaison → objet B répond → conclusion. On comprend même sans le son quand l'idée le permet.
- Couper de la facecam à la scène explicative **quand la parole le nécessite**, et revenir au visage lorsque l'idée est démontrée.
- Sous-titres synchronisés avec **vrais timecodes**. Si le mot-à-mot n'est pas vérifié, ne pas prétendre qu'il l'est ; éviter tout texte présenté comme citation directe.
- Respecter la vidéo native (16:9 reste 16:9), la voix originale, le timing après coupes et les gestes/visages.

### 5. RÈGLES ÉDITORIALES PAR INSTANT
Pour chaque passage, l'orchestrateur Edit+ choisit **une seule intention dominante** :
1. **Émotion / conviction** → facecam, cut discret ou punch-in motivé.
2. **Concept abstrait** → scène avec objet représentatif et mécanisme illustré.
3. **Comparaison** → deux groupes d'objets / colonnes visuelles, puis relation.
4. **Processus** → objets et connecteurs construits étape par étape.
5. **Chiffre** → graphique uniquement si valeur et signification attestées.
6. **Preuve** → média réel autorisé, crédit/licence enregistrés.
7. **Phrase qui se suffit** → **aucun effet**.

Jamais d'animation toutes les N secondes par défaut. L'agent choisit le bon outil, pas la densité maximale.

### 6. EXEMPLE APPLICABLE À NOTRE RUSH
Si la transcription alignée confirme les expressions suivantes :
- « aider les autres » : apparaissent des personnes stylisées et une interaction utile, puis un lien visuel vers un besoin concret. Pas de « faux clients ».
- « créer de la valeur » : un problème représenté par un bloc visuel évolue vers une solution ; aucun nombre de revenus inventé.
- « apprendre à résoudre un problème » : étapes lisibles **observer → comprendre → résoudre** uniquement si la formulation reflète le sens exact du passage ; sinon générer une autre représentation fidèle.

Le principe est **texte vérifié → décision éditoriale → objet → animation → retour au discours**, jamais l'inverse.

### 7. MOTEUR ET CONTRAT
HyperFrames **rend** les compositions ; l'analyse vidéo, l'alignement, la sélection narrative et les cuts nécessitent l'orchestrateur Edit+.

Entrée structurée attendue pour chaque scène :
- `sourceText`, `startMs`, `endMs` **après remapping des cuts** ;
- `sceneType` (HEAD, OBJECT_EXPLAINER, COMPARISON, PROCESS, DATA, PROOF, RETURN) ;
- `editorialReason`, `evidence` et `sourceConfidence` ;
- `objectSpec` (formes, matériaux, taille, hiérarchie, mouvement, entrée/sortie) ;
- `protectedRegions` (visages, mains, textes), `assetRights`, `audioPolicy`.

Préférer des composants SVG/HTML/CSS déterministes, animés par des timelines GSAP **seekables** ; vérification HyperFrames `lint`, puis `render`, puis inspection vidéo/audio. Ne pas animer `display`, `visibility` ou `autoAlpha` sur les éléments `.clip` gérés par HyperFrames.

### 8. LIVRABLES ET ACCEPTATION
Produire **la vidéo complète**, pas une démo de 12–17 secondes. Fournir :
1. MP4 au format original avec **voix d'origine non doublée** ;
2. sous-titres réellement alignés ou absence de promesse de synchronisation ;
3. storyboard horodaté expliquant chaque cut / animation / objet ;
4. aperçu des scènes clés et rapport QA.

Refuser la validation si objets sans rôle, chiffres inventés, animation mal alignée après cuts, face masquée, surcharge, contraste faible, sound design caricatural, bandes blanches, ou différences non significatives avec les autres modèles.

**Objectif : donner l'impression qu'un monteur expérimenté a décidé de chaque image — et qu'un motion designer professionnel l'a exécutée.**
