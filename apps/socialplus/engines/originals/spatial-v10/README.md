# Edit+ · Modèle 05 · Spatial UI V10 — VERSION DE RÉFÉRENCE

**Date de verrouillage créatif : 20 octobre 2026.**

## À conserver sans changement
- Perspective, trajectoires, morphing et finesse de la V9.
- Trois focus cinématiques sur **Compétence / Offre / Prospection** ajoutés en V10.
- Sous-titres lisibles sans gros encadré et retour fluide à l’interface spatiale.
- Voix originale, cadre horizontal 910×512, 30 i/s, durée 47,2 s.
- Aucun changement aux médias sans demande explicite.

## Contenu de la sauvegarde
- `media/EDITPLUS_SPATIAL_UI_V10_FOCUS.mp4` : **export validé visuellement par l’utilisateur**.
- `media/EDITPLUS_SPATIAL_UI_V9_MOTION_FLOW.mp4` : base audiovisuelle intacte.
- `files/IMG_0516.mp4` : rush brut original.
- `code/editplus_spatial_ui_v8_pipeline.py`, `...v9_motion_flow.py`, `...v10_focus.py` : **sources originales exactes**.
- `code/portable_*.py` : copies adaptées pour les chemins de ce dossier.
- `run_v10.py` : reproduit le traitement V10 en utilisant la vidéo V9 comme base, avec piste audio recopiée.
- `MANIFEST.json` : empreintes SHA-256 des fichiers-clés et paramètres vidéo.

## Reproduire localement le rendu V10
Nécessite Python 3.11+, `pip install opencv-python numpy pillow`, FFmpeg/FFprobe dans PATH, et les polices **Inter** disponibles localement (non incluses). Pour d'autres polices, adapter les chemins de fontes.

Sur Linux (fontes Inter installées à `/usr/share/fonts/opentype/inter`), depuis le dossier décompressé :

```bash
python3 run_v10.py
```

Sur Windows, utiliser un environnement Python et définir `EDITPLUS_FONT_DIR` ainsi que `EDITPLUS_FONT_REGULAR`, `EDITPLUS_FONT_MEDIUM`, `EDITPLUS_FONT_SEMI` selon les fichiers Inter locaux.

La reconstruction vise une **équivalence audiovisuelle**, pas une identité binaire entre encodages FFmpeg différents. L’export `media/...V10_FOCUS.mp4` est le **master exact archivé**, à privilégier.

## Limites attestées
- Il s'agit d'un **montage déterministe du rush IMG_0516**, pas encore d'un moteur Edit+ universel ni d'un composant frontend React.
- La perspective est en **2,5D** ; le masquage est local, non une reconstruction géométrique 3D.
- Les bornes temporelles des 172 mots proviennent d'une répartition de segments ASR : la synchronisation phonétique précise n'est **pas certifiée**.
- Avant diffusion commerciale du *service* Edit+, vérifier mots, audio à l'écoute, occlusions et adaptation à plusieurs rushes.

**Décision : DA V10 gelée ; aucune retouche artistique demandée.**
