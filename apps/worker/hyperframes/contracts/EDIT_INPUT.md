# Contrat d'entrée Edit+ → HyperFrames

L'orchestrateur Edit+ doit fournir au moteur un manifeste par vidéo, jamais des slogans non synchronisés :

- `preset_id` ∈ `codie_omni`, `alex_hormozi_omni`, `apple_premium`, `leila_hormozi`.
- `media` : chemin local sûr, taille native, fps, durée, aspect ratio, audio original.
- `transcript` : mots + `start_ms`/`end_ms`, origine, statut d'alignement et confiance. **Si non vérifié** : pas de prétendue transcription exacte.
- `segments` : coupes source, timecodes d'entrée/sortie et correspondance de la timeline de sortie ; aucune coupe au milieu d'un mot.
- `visual_proof` : frames vérifiées avec rectangles protégés (visage, mains, objets, tableau, sous-titres), fréquence d'échantillonnage et confiance. En l'absence de preuve : effet discret et hors de la zone centrale.
- `events` : moment de sortie, type, texte/citation **sourcé**, motif narratif, durée, preset, priorité et éventuelle licence.
- `render` : résolution, format natif ou explicitement choisi, langue, profil colorimétrique, audio original.
- `qa` : statut de la synchronisation, lisibilité mobile, problèmes de superposition, clipping, décodage, métadonnées de provenance.

La composition HTML/CSS/GSAP matérialise les événements ; elle n'est PAS chargée de deviner les paroles ni de sélectionner des médias non autorisés.

**Déploiement** : usage local/CI d'abord. Aucun basculement automatique de la production Railway sans test E2E et contrôle qualité éditorial.
