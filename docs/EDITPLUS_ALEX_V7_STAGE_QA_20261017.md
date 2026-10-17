# Edit+ — Alex Hormozi V7 | Validation de staging — 17 octobre 2026

## État réel
- **Design V7 Apple Kinetic** : verrouillé, pas de cadres de sous-titres, format natif et voix originale à préserver.
- **GitHub** : PR #28 sur `editplus-alex-v7-audio-driven-staging-20261017`. Pas fusionnée, ni déployée sur le worker public.
- **Vidéo existante de référence** : `EDITPLUS_ALEX_HORMOZI_V7_APPLE_KINETIC_COMPLET.mp4`, 38,50 s, 1280 × 720/30 ips, H.264 et AAC stéréo, issue de `IMG_0506.mp4` (44,50 s, 910 × 512/30 ips, stéréo).
- **Transcription mot à mot sur la vraie voix** : non disponible et non approuvée. L'existant montre des mises en valeur éditoriales, pas une transcription fidèle exhaustive.
- **Démo ASR/HyperFrames CI** : 4,5 s, faux mots et sans audio utilisateur — démontre le fonctionnement du moteur de timing, pas le résultat sur le rush réel.

## Corrections apportées pendant cette reprise
- Contrôle des durées : si la somme des segments conservés diverge de la durée de sortie de > 100 ms, le plan est bloqué (évite le décalage des sous-titres après cut).
- Suppression du chevauchement temporel entre deux groupes successifs de sous-titres.
- Régression ajoutée : échec fermé pour timeline périmée; vérification de l'absence de superposition.
- Commit code `a3e7402a58cca58f9d6a7c8b5be08df5f9b8a075`.
- Commit tests `9e02822d0ad34ac3cbace6b5a77ff5d79decc11d`.

## Contrôles exécutés
- Décodage FFmpeg complet du rush original **réussi**.
- Décodage FFmpeg complet de la vidéo V7 existante **réussi**.
- Flux vidéo V7 1280×720, 30 fps; une seule piste AAC.
- Détection automatique de segments entièrement noirs >= 0,2 s : aucun segment signalé.
- Mesure simple V7 : moyenne -18,7 dBFS et pic 0,0 dBFS (pas une certification de loudness ni une écoute).
- GitHub Actions PR #28 : `static-checks` PASS, `alex-v7-word-sync` PASS, `alex-v7-hyperframes-visual-proof` PASS.

## Critères manquants — BLOQUANTS pour publication
1. Lancer Gemini avec le rush source réel, obtenir un manifest mot-à-mot horodaté vérifiable.
2. Comparer à la voix originale, corriger mots/timecodes, valider les coupes et les animations sans anticipation.
3. Rendre les 38–45 secondes de la vidéo corrigée avec HyperFrames, inspecter les frames, écouter en continu sur haut-parleur et casque.
4. Tester sur au moins deux autres sources (dont vertical et scènes complexes), puis intégrer et déployer le preset dans Edit+.

**Verdict** : le code et son test synthétique sont validés; le rendu complet et le modèle autonome commercialisable **ne le sont pas**. Pas de mise en production.
