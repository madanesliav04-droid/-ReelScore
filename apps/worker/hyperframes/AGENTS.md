# Edit+ / HyperFrames — instructions obligatoires pour l'agent

Avant toute composition ou modification vidéo :
1. Lire `BRIEF.md` (objectif éditorial, contraintes et preuves).
2. Lire `DESIGN.md` (design system partagé et règles de composition).
3. Lire **uniquement** le document `presets/<model_id>.md` correspondant au modèle demandé.
4. Lire `REFERENCE_MANIFEST.md` et inspecter les références visuelles réelles, si accessibles ; ne jamais en inventer les caractéristiques.
5. Valider le contrat d'entrée `contracts/EDIT_INPUT.md`. Ne pas fabriquer de transcript, chiffre, preuve ou média absent.
6. Construire des compositions **HTML/CSS avec clips data-* et timeline GSAP paused**, et rendre via HyperFrames.
7. Prévisualiser puis contrôler l'export et signaler les écarts. Une exportation réussie ne vaut pas validation artistique.

Le moteur HyperFrames ne déduit pas le style de ces fichiers tout seul : c'est **l'agent qui doit les lire puis générer le code**. Les quatre modèles ont des comportements visuels et narratifs différents : **interdiction de n'en changer que les couleurs**.

Ne pas modifier la production Railway, ni activer `ENABLE_HYPERFRAMES_RENDER`, sans test bout-en-bout validé. Ne jamais placer de secrets, d'URL signées ou de médias clients dans un dépôt public.
