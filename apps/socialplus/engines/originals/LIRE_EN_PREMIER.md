# Social+ — Récupération des sources originales pour Codex

Inventaire réalisé le 22 octobre 2026 depuis la bibliothèque de fichiers des anciennes conversations ChatGPT.

IMPORTANT : les MP4 sont des références de résultat; ils ne prouvent PAS que le moteur de montage autonome fonctionne sur un nouveau rush. L’objectif est de réutiliser les sources, sans inventer ou refaire au hasard les presets historiques abandonnés.

## Catalogue des six directions à implémenter
1. Codie × OMNI V60 — archive QA contient vidéo, build_v60.py, captions ASS, QA.
2. Alex Hormozi V16 — archive de référence contient master V16 et contrôles QA; moteur JS existant dans une branche GitHub distincte (voir document dans dossier Social Kinetic).
3. Leila Hormozi V53 — master MP4 et scripts de rendu dans ZIP source/QA.
4. Social Kinetic V28 — master MP4 V28; archive V27 précédente comme soutien de référence (ne remplace pas V28) ; code V28 GitHub dans branche dédiée (voir document).
5. Apple Premium / Spatial UI V10 — archive complète avec master, rush, scripts Python, storyboard, manifest.
6. Cinematic Storytelling V7 — archive de projet avec rush, scripts Python/FFmpeg, timing et références; MP4 final V7 séparé. L'archive projet contient une vidéo de référence V6, pas le master final V7 : ne pas les confondre.

## Intégration ciblée (économie de crédits)
1. Lire README et le MANIFEST_SHA256.json; inspecter seulement les archives nécessaires.
2. Comparer le code existant Social+ avec ces sources (ne pas tout réécrire).
3. Ne pas confondre direction artistique validée et pipeline automatisé fonctionnel.
4. Intégrer chaque moteur avec tests ciblés sur des rushs NOUVEAUX, gestion des erreurs, audio original unique, word-sync, cuts, safe zones, animations et export MP4.
5. Protéger les originaux, travailler par branche/PR et ne pas déployer sans accord.
6. Les dépendances manquantes ne doivent pas être inventées : indiquer exactement celles qui manquent.

## GitHub déjà accessible via compte connecté
Repo : https://github.com/madanesliav04-droid/-ReelScore
Alex : branche `editplus-alex-reference-lock-20261017` — apps/worker/src/hormozi-omni-director.js, hormozi-omni-render.js, hormozi-beat-timing.js.
Social Kinetic : branche `editplus-integrate-social-kinetic-v28-20261018` — apps/worker/src/social-kinetic-v28-engine.js, social-kinetic-v28-runtime.js, tests/social-kinetic-v28-integration.test.mjs et hyperframes/social-kinetic-v28-speech-timed.
Ces moteurs historiques sont à examiner et porter; aucune preuve de compatibilité production sans nouveau test.

## Note sur les vidéos
Ne pas déposer par défaut tous les MP4 et rushs en production publique. Respecter les droits, les données personnelles et protéger les masters et rushs bruts.
