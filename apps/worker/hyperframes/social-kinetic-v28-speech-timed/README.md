# Edit+ V28 — synchronisation des bulles sur les paroles

La V27 est conservée (sous-titres V16, titres verts, checklist, coupes et voix originale).

## Déclenchements éditoriaux
- ~29,30 s : APPRENDRE QUELQUE CHOSE (estimation d'apparition du mot « apprendre »)
- ~32,13 s : PRÊTES À TE PAYER
- ~35,13 s : GAGNER DU TEMPS
- ~36,60 s : GAGNER DE L'ARGENT

La première paire s'empile en cascade 1→2 à droite, puis s'efface avant le geste. Les deux bénéfices de fin apparaissent un par un, en bas à droite. Le premier rendu V28 avec quatre bulles empilées a été refusé car il masquait réellement le visage à ~35,6–36,9 s. Cette correction ne modifie aucun autre composant.

## Paroles
Une transcription indépendante du MP4 contient 6 segments (~150 jetons, confiance moyenne 0,956). Après correction probable FERAS à la place de SERAS dans le manifest historique, 146/154 mots normalisés concordent dans la comparaison automatique. Quatre variations se regroupent en trois zones non tranchées : TU NE vs JE et D'ARGENT vs L'ARGENT (ouverture), DÈS LE vs DE (question), RÉSIDE CHEZ EUX vs RÉSISTE (conclusion). Il n'existe pas encore de forced alignment certifié au mot près.

## QA
HyperFrames CLI officiel : rendu entier réussi. MP4 41,1 s, 1233 images, 910x512, H264/AAC. 22 instants de bulles contrôlés : 0 recouvrement entre bulles ; QA automatique mentionne deux faibles intersections avec rectangles larges de détection du visage (35,31s et 37,06s), revue visuelle des captures ne montre pas les traits du visage masqués. Une seule piste mixée, -16,6 LUFS et -1,3 dBTP. Les sons de bulle sont recadrés sur les entrées et sont originaux/synthétisés.

PR brouillon : validation des trois passages ambigus par écoute et vérification acoustique mot à mot recommandée avant verrouillage éditorial complet. Commercialisation toujours conditionnée à 3 tests autonomes UI→worker→MP4.
