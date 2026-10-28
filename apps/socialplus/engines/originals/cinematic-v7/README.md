# Social+ — Cinematic Storytelling, V7 finale (IMG_0506)

**Code source réel** utilisé pour rendre la V7 validée, reconditionné pour être exécuté depuis ce dossier. Les vidéos sont les fichiers utilisateur d'origine et la V6 de référence.

## Lancer le rendu

Prérequis : Python 3.10+, FFmpeg disponible dans le PATH, polices Inter installées sur le système (ou une police de remplacement).

```bash
pip install -r requirements.txt
python src/render_v7.py --check
python src/render_v7.py
```

Sortie attendue : `exports/IMG_0506_CINEMATIC_V7_PREMIUM_FINAL_IPHONE.mp4`

## Structure

- `src/render_v7.py` : **code prêt à relancer** (chemins relatifs, contrôle d'entrée).
- `src/render_v7_original_reference.py` : script tel qu'il a produit la V7 dans l'environnement initial, conservé pour comparaison.
- `src/render_v6_historique.py` : code de construction de la V6 servant de référence de rendu ; **historique**, avec dépendances aux fichiers de travail précédents non incluses.
- `media/IMG_0506(2).mp4` : rush brut de départ.
- `media/IMG_0506_CINEMATIC_V6_APPLE_MINIMAL_IPHONE.mp4` : séquences cinématiques plein écran utilisées par la V7.
- `config/IMG_0506_CINEMATIC_V6_TIMING.json` : synchronisation des mots utilisée par le rendu.
- `config/modele_v7.json` : réglages, scènes et décisions de DA.
- `reference_hyperframes/` : **prototype HTML/Hyperframes antérieur** ; il ne représente PAS le code natif de la V7 et n'a pas été testé par la CLI Hyperframes.

## Éléments définitivement approuvés

- 16:9 horizontal, voix originale, pas de B-roll ; face caméra sans encadrés en bas à gauche.
- Sous-titres fins sans fond ni contour de boîte, visibles uniquement face caméra.
- 4 séquences graphiques cinématiques plein écran et transitions douces.
- Palette sobre bleu nuit/doré, design minimaliste.

## Limites importantes

- **Le MP4 V7 validé n'a pas été rendu par Hyperframes**, mais par Python / OpenCV / FFmpeg. Ce code reproduit la composition réellement utilisée.
- Le texte des sous-titres vient de la transcription antérieure ; les horaires des mots sont estimés à partir des segments audio. L'utilisateur a validé la synchronisation de la V7.
- Le rendu dépend des polices Inter du système : une police de substitution peut légèrement modifier les espacements.
- La V7 est une *référence* spécifique à ce rush. Pour adapter à une nouvelle vidéo, il faut réviser les cuts, les phrases et les animations en fonction de la narration. Ne pas prétendre que le script le fait automatiquement.

Aucune police, aucune voix générée ni aucun B-roll ajouté n'est inclus dans ce projet.
