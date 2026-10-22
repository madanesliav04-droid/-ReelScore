# Réemploi des moteurs et résultats locaux

Le code récupéré est traçable dans `REUSED_ENGINE_SOURCES.json`. Aucun moteur existant n'a été réécrit. Les fichiers sous `apps/worker` proviennent de la branche `editplus-integrate-social-kinetic-v28-20261018`, commit `c1d64744d86cbcf1362104ee76c89ccd3f6af8f2`. Les modules `hormozi-omni-director.js`, `hormozi-omni-render.js` et `hormozi-beat-timing.js` ont les mêmes blobs dans les branches Alex reference-lock et Alex v8 examinées. Le candidat v8 ajoute une autre typographie Hyperframes et ses gates ; il ne prouve pas la présence du pack approuvé V16.

`apps/socialplus/server/render.mjs` fournit le catalogue des six références, le préflight FFprobe et les adaptateurs locaux. Les six références restent désactivées dans l'interface tant que leur recette n'est pas terminée. Les raisons et les noms de fichiers absents sont renvoyés par le catalogue ; ce ne sont pas des boutons de rendu fictifs.

| Référence | Éléments retrouvés | Limite de cette livraison |
|---|---|---|
| Codie × OMNI V60 | Anciens modules OMNI | Ni `build_v60.py`, ni le pack QA V60, ni le MP4 approuvé retrouvés ; aucun remplacement |
| Alex Hormozi V16 | Directeur OMNI, chronométrage des beats, renderer ASS et candidat v8 | Pack V16 absent. Le code de référence OMNI est exécutable en laboratoire, sans certification de fidélité V16 |
| Leila V53 | Anciennes grammaires Leila | Archive V53 et `render_leila_v53.py` absents ; aucun remplacement |
| Social Kinetic V28 | Planificateur, runtime, tests d'intégration et prototype HTML | Hyperframes local, mots fournisseur vérifiés et preuves indépendantes de placement nécessaires ; pas de recette sur trois nouveaux rushs |
| Apple Premium / Spatial UI | Prototypes antérieurs | `EDITPLUS_MODELE05_V10_CODE.zip`, packs V4/V5 et identification du master approuvé absents |
| Cinematic Storytelling V7 finale | Branche cinematic-v2 inspectée : prototypes JavaScript | Archive 38 Mo, script Python 25 Ko, rush, timings et réglages V7 absents. Hyperframes n'est pas le moteur approuvé |

L'export technique `technical-export` est une fonction séparée : il convertit réellement le rush original en H.264/AAC, conserve son orientation et sa durée, sélectionne une seule piste audio source et ne crée aucun montage artistique. Il n'active aucun des six modèles. Les résolutions impaires sont arrondies au pixel pair inférieur pour H.264, sans bandes ajoutées.

Le raccord Alex est protégé par `SOCIALPLUS_BETA_RENDER=staging` et conserve les validations du directeur existant : mots alignés, quantité présente dans les paroles, séquence/comparaison liée aux mots et preuve indépendante d'espace sûr. Sans preuves, il renvoie `VERIFIED_EVIDENCE_REQUIRED`. Le raccord V28 conserve également ses flags `ENABLE_SOCIAL_KINETIC_V28=staging` et `ENABLE_HYPERFRAMES_RENDER=true`, ainsi que ses validations. Ces flags ne doivent pas être activés en production avant recette. Le navigateur ne peut pas choisir un chemin de fichier serveur ni activer un flag.

## Essais exécutés

```bash
node --test --test-isolation=none --test-reporter=spec apps/worker/tests/hormozi-*.test.mjs apps/worker/tests/social-kinetic-v28-integration.test.mjs
node --test --test-isolation=none --test-reporter=spec apps/socialplus/test/render.test.mjs
node apps/socialplus/scripts/verify-render.mjs
```

Les 17 assertions de régression des moteurs ciblés passent. Les trois tests du nouvel adaptateur passent : refus des modèles non admis, trois conversions FFmpeg réelles (paysage/portrait/carré, codecs/durée/audio), et composition ASS Alex réelle avec refus préalable si preuve absente. L'audio décodé des conversions conserve la fréquence source de 440 Hz et une seule piste AAC.

Les vidéos de ces essais sont **des fixtures synthétiques techniques**, couleurs unies et tonalité ; leurs preuves de mots/cadrage pour l'essai ASS sont également synthétiques et ne prétendent pas analyser un sujet réel. Elles ne certifient ni la synchronisation d'une parole ni la qualité artistique V16. Les rushs de discours inconnus, les références approuvées et l'écoute humaine manquent pour la recette de chacun des six modèles. Aucun essai de rendu V28 Hyperframes n'a été déclaré réussi.

Le script conserve les MP4, SHA-256, métadonnées FFprobe et durées locales dans `artifacts/render/report.json`. Il ne contacte aucun service payant et ne déploie rien. Les coûts mesurables ici sont le temps CPU local et la taille des fichiers ; aucun prix d'hébergement ou coût de production n'est extrapolé.

## Contrat d'intégration

- `MODEL_CATALOG` : six entrées `{id,label,version,status,sourceAvailable,available,reason,missingSources}` ; `status` vaut `beta` ou `reference_only`.
- `TECHNICAL_EXPORT` : conversion séparée, utilisable localement.
- `probeVideo(path)` : durée, taille, dimensions après rotation, codecs, conteneur, MIME, nombre de pistes audio et canaux.
- `renderVideo({sourcePath,outputPath,modelId,analysis,timeline,frameProof,editorialEvents,onProgress,signal})` : chemins internes autorisés uniquement ; renvoie audit et métadonnées. L'appelant conserve les contrôles d'identité, de quota et de propriété du projet.
- `RenderError` : erreur structurée avec `code`, message français et détails techniques réservés aux journaux privés. Ne pas renvoyer les chemins internes ou les stderr bruts à l'utilisateur.

Les sous-processus sont lancés sans shell. Les probes et conversions restreignent les protocoles aux fichiers/pipes et les conteneurs à une liste explicite pour empêcher l'import d'une playlist réseau. L'export technique et le raccord Alex acceptent l'annulation et un délai maximal. Le runtime historique V28 conserve son propre délai Hyperframes ; il n'est pas exposé comme moteur autonome prêt.
