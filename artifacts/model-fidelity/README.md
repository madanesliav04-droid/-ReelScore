# Six modèles — preuves de validation ciblée

Les six exports sont des prévisualisations issues du rush parlé réel, pas des masters approuvés. `individual-audit.json` détaille séparément les écarts restants. Aucun score de fidélité ni validation commerciale n’est attribué.

- `media-qa.json` : décodage intégral, dimensions natives, H.264/AAC, empreinte audio commune, corrélation avec la voix source après chaque coupe et empreintes MP4. Ces mesures ne certifient pas les phonèmes.
- `browser-qa.json` : import réel, ASR locale, propositions de correction non confirmées, brouillons des six plans, rendu Codie, lecture de prévisualisation et téléchargement MP4. Le navigateur ne rend pas les six modèles ; le script local distinct les rend tous.
- `../model-fidelity-*.log` : tests ciblés des composants, limites de coupes, rôles de polices/licences, validation des scènes et refus de valider un mot marqué incertain.

Reproduction locale : `node apps/socialplus/scripts/render-real-rush.mjs SOURCE PLAN.json DOSSIER_PRIVE`, puis `python3 apps/socialplus/scripts/verify-spoken-rush.py SOURCE DOSSIER_PRIVE`. Le plan doit correspondre à l’empreinte du rush, contenir les vrais mots et des placements revus. Aucun appel distant ni téléchargement de modèle pendant le rendu. Voir aussi le script `browser-spoken-rush.mjs`. Les éléments privés restent hors GitHub.
