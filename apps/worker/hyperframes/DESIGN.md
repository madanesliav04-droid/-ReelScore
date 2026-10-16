# EDIT+ — DESIGN SYSTEM ET LANGAGE DE MONTAGE
Version 1.0 · À appliquer avec le preset spécifique, jamais à sa place.

## Hiérarchie
1. La personne et le sens de la phrase.
2. Un effet motivé et limité dans le temps.
3. Les sous-titres (fidèles, calibrés au plan).
4. Les éléments secondaires uniquement s'ils augmentent la compréhension.

## Composition et lisibilité
- Prendre en compte le visage, les mains, le tableau, les éléments du décor et les zones de texte mobile avant chaque effet.
- Marges de sécurité calculées dans la résolution réelle ; ne pas supposer un rectangle libre fixe.
- Éviter de coller les titres au bord ou au visage ; tester les positions sur les frames **pendant** les gestes.
- Typo : une famille dominante, une secondaire seulement si justifiée par le preset ; poids et interlignage cohérents.
- Palettes **adaptées au contraste du plan**. La couleur d'accent du preset n'est pas obligatoirement appliquée à chaque shot.
- Toute animation a une entrée, une durée utile, une sortie ; pas d'effets gratuits.

## Mouvement
- Courbes d'accélération douces et consistantes. Préférer le naturel : 150–500 ms pour interfaces et petits éléments, ou rythme réellement dicté par la voix.
- Ne pas empiler simultanément zoom, glissement, tremblement, flash et impact sonore.
- Recadrages limités et motivés ; pas de zoom continu parce que le moteur peut le faire.
- Après cuts, remapper événements et sous-titres sur la **timeline de sortie**.

## Son et image
- Voix d'origine toujours prioritaire. Effets sonores sobres et peu fréquents, pas de son décoratif systématique.
- Respecter le rapport d'aspect natif ; format de sortie défini par l'utilisateur, jamais imposé par le preset.
- Rendu haute qualité, vérifié : audio intégré, pas de clipping, pas de sous-titres tronqués.

## HyperFrames et assets
- HTML sémantique + `data-composition-id` + clips `class="clip"` avec `data-start`, `data-track-index`.
- Une timeline GSAP racine **paused** enregistrée dans `window.__timelines` ; animations seekables et déterministes.
- Éléments complexes réutilisables en sous-compositions `compositions/`.
- Polices et médias intégrés localement quand licence le permet ; aucun CDN requis pendant rendu final.
- La sortie doit pouvoir être assemblée sans substituer la piste audio originale.
