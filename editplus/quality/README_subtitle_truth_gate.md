# Edit+ — Contrôle commun des sous-titres (V15)
Cette branche contient le module `editplus/quality/subtitle_truth_gate.py`.

## Obligation pour TOUS les modèles
À exécuter après montage (timecodes post-cuts) et AVANT tout état "prêt à publier", quel que soit le style : Alex Hormozi, Leila Hormozi, Codie Sanchez, Impact, Clean, Authority, Explainer, Data, UGC natif, Cinématique/Story. Les nouveaux modèles héritent du même contrôle.

Le worker de montage doit créer un manifest JSON comportant :
- `preset`, `media_sha256` (empreinte du média transcrit)
- `transcript`: `provenance: asr_verified|human_verified`, `engine`, même `media_sha256`, `words: [{text,start,end,confidence}]` ;
- `captions: [{text,start,end,bbox:[x0,y0,x1,y1]}]`, en coordonnées relatives à l'image ;
- `visual_overlays: [{start,end,bbox}]`.

Ne jamais utiliser les captions historiques ou des scripts imaginés comme *preuve* de transcription. L'ASR réel et sa vérification humaine restent des dépendances externes à fournir, et les timecodes sont ceux du rendu final après cuts.

**Commande de recette :**
```bash
python editplus/quality/subtitle_truth_gate.py manifest.json
```
Code retour 0 : APPROVED. Code retour 2 : BLOCKED. Pour tout autre résultat, le worker doit refuser la livraison automatique du statut "prêt à publier" ; un rendu brouillon pour revue reste permis.

**État réel :** QA codée sur cette branche, mais **non raccordée ni déployée dans le worker Railway** (image externe `viral-edit-worker`). Ne pas présenter cette branche comme une vérification active de production. Les vidéos V15 B et D restent BLOQUÉES côté exactitude des paroles tant qu'une transcription fiable, mot à mot, n'a pas été exécutée.
