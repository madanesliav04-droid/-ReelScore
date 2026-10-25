# Social+ — vrai rush vertical — 25 octobre 2026

**Verdict : non commercialisable à ce stade. Score fonctionnel global : 80/100 (79 auparavant).** Ce score mesure une couverture de validation ; il n’est ni une note artistique ni la moyenne des modèles. Les modèles gardent leur barème strict distinct. Aucun 100/100 attribué.

## Exécution réelle

- Rush fourni : 512 × 910 natif, 27,167 secondes, voix mono originale. SHA-256 dans MODELS.json.
- Six MP4 complets produits par les six ports existants ; pas de moteur remplacé. Cinematic utilise le planificateur autonome de la route web, avec quatre scènes issues du nouveau discours, sans média ni timing V6.
- Décodage FFmpeg intégral des six exports réussi. H.264 High niveau 3.1, yuv420p, AAC, moov avant mdat : conteneurs adaptés à la lecture progressive iOS ; ce contrôle ne remplace pas Safari physique.
- Piste audio PCM décodée intégralement identique à la source pour chacun des six fichiers (1 302 919 échantillons à 48 kHz). Une seule piste audio : ni doublage, ni déformation, ni bruitage ajouté. Aucune prétention à avoir écouté les effets sonores des masters.
- Comparaison de la zone caméra à 18, 23 et 25 secondes : meilleur décalage parmi −1/30, 0 et +1/30 s égal à zéro sur les six sorties. Ce sondage ne certifie pas une synchronisation labiale complète.
- Aucune pause intérieure admissible ≥0,8 s dans l’analyse ; aucune coupe ajoutée. Ce rush valide la conservation des phrases, pas une nouvelle recette de cuts. Les preuves antérieures de coupe horizontale restent distinctes.
- 107 entrées ASR, 107 entrées sous-titrées programmées dans chaque modèle. Aucun groupe multi-mot sans frontière distincte signalé sur ce nouveau rush. Horaires Whisper bornés acoustiquement, sans alignement phonétique indépendant.
- Cinq alertes de confiance faible, indiquées dans TRANSCRIPT_STATUS.json : aucune confirmée artificiellement. Une confiance élevée ne prouve pas non plus l’exactitude d’un mot.

## Défauts corrigés

1. **Majeur — Cinematic :** les scènes plein écran supprimaient tous les sous-titres de leur intervalle alors que le graphisme ne reprenait pas toutes les paroles. Sous-titres mot à mot désormais conservés en bas, graphismes et transitions inchangés. Test de couverture pendant une scène réussi ; nouveau rendu autonome contrôlé.
2. **Majeur — portrait :** les ancrages étroits hérités de l’horizontal réduisaient fortement les graphismes. Proposition de bande haute large en portrait, avec guide identique dans l’interface et validation de placement toujours exigée. La zone n’est pas une détection automatique des visages/mains.
3. **Majeur — Kinetic :** la bande large révélait une bulle étirée avec petit texte. Ajustement au texte et taille de police portrait minimale ; test Chromium des dimensions réelles réussi. Compositeur et animations V28 originaux conservés.
4. **Majeur — interface :** le nom long du fichier pouvait élargir la grille de projets et perturber la navigation mobile. Colonne de grille rétrécissable corrigée ; parcours complet avec ce nom et contrôle d’absence de débordement réussis.

Les rendus ont été régénérés uniquement pour les défauts effectivement corrigés. Les contrôles audio, empreintes et téléchargements finaux correspondent aux derniers fichiers, pas aux essais intermédiaires. Le premier essai direct Cinematic à événements génériques a été remplacé par l’export du planificateur autonome réellement utilisé par l’application.

## Comparaison aux références

Les six masters existants ont été échantillonnés à 8, 16 et 24 secondes, face à trois instants graphiques du nouveau rush (ou caméra pour Codie). Six planches privées examinées. C’est une inspection visuelle d’échantillons, **pas** une recette audiovisuelle intégrale ou une mesure automatique de fidélité.

| Modèle | Points justifiés /100 | Écart restant principal |
|---|---:|---|
| Codie × OMNI | 45 | Aucun mot temps/argent dans ce rush : pas de pictogramme pertinent déclenché. Grammaire V60 complète non certifiée. |
| Alex Hormozi | 45 | Titres lexicaux et composition portrait ne démontrent pas les explications narratives des masters. |
| Leila Hormozi | 45 | Placement amélioré ; contraste mural et détails secondaires restent à approuver. |
| Social Kinetic | 40 | Bulle lisible corrigée ; la grammaire latérale de phrases du master n’est pas reproduite complètement. |
| Cinematic V7 | 50 | Quatre scènes autonomes et sous-titres continus ; fidélité globale caméra/graphismes et phonétique non approuvées. |
| Apple Premium / Spatial UI | 40 | Focus sur le visage et flou plus présents que les compositions murales discrètes de référence. |

Barème conservé : transcription 25, synchronisation 20, transitions 15, graphisme 15, audio 10, cuts 10, autonomie 5. Détail dans MODELS.json. Les scores cumulent les preuves horizontales précédentes et les nouveaux contrôles verticaux ; ils ne signifient pas un taux de mots corrects. Aucun point de transcription acquis sans vérité terrain vérifiée. Leila gagne cinq points de graphisme pour la lisibilité du placement corrigé, sans obtenir le maximum.

## Les 19 anciennes entrées

Les 19 extraits audio déjà générés existent toujours, sont non vides et leurs empreintes ont été vérifiées. **0 confirmé automatiquement ; 19 restent à valider humainement**, dont quatre groupes sans frontières mot à mot distinctes. Les hypothèses et timings candidats antérieurs ne deviennent pas des corrections prouvées. Aucun média de l’ancien rush n’a servi au montage vertical.

PREVIOUS_19_STATUS.json conserve les indices et timecodes exacts sans publier les paroles privées dans ce dépôt public. Le dossier privé de livraison contient le rapport initial et les 19 extraits réutilisés. Une écoute humaine est nécessaire pour résoudre les ambiguïtés ; aucun outil d’écoute phonétique directe n’est disponible dans cette session.

## Tests et parcours

- **123/123 tests Node réussis**, zéro échec ou test ignoré : full-tests-final.log. Les tests ciblés se recoupent avec cette suite ; ne pas additionner leurs comptes.
- Parcours réel dans Chromium mobile : authentification → import du fichier fourni → analyse acoustique et repères éditoriaux locaux → même source → ASR local → choix des six modèles → rendu Leila → reprise dans Projets → lecture et téléchargement. Résultats REAL_FLOW.json, aucun résultat éditorial simulé.
- Lecture des six MP4 finaux dans les dialogues authentifiés de l’application, images réellement décodées, téléchargement des six fichiers et égalité SHA-256 avec chaque original généré.
- Six largeurs testées : 320, 390, 402, 440, 768, 1440 ; mouvement réduit ; aucune erreur JavaScript dans le parcours.
- L’export de chaque moteur a été exécuté directement via le serveur de rendu existant ; seul Leila a subi le parcours d’import/rendu complet dans le navigateur pour ce rush. Les six autres lectures/téléchargements utilisent des projets privés de recette référençant ces vrais exports, sans simulation de rendu.
- **Safari/iPhone physique : non exécuté.** Partage natif, VoiceOver, performances matérielles et Dynamic Island restent à valider. Windows natif non exécuté. Guide HTTPS Wi-Fi local existant : docs/social-plus/V2_IPHONE_ET_COMMERCIALISATION.md.

## Limites de livraison et commercialisation

Les vidéos et planches restent hors du dépôt public. Archive privée préparée dans `/workspace/socialplus-private-renders/v2-vertical/download/`. Aucun nouvel hébergement activé. Le transfert authentifié testé concerne l’application locale dans le navigateur de recette ; il ne prouve pas un téléchargement de l’artefact Codex sur l’iPhone du propriétaire. L’environnement ne fournit aucun outil de publication d’artefact natif et `/mnt/data` n’existe pas et n’est pas créable par le compte courant. Un lien HTTPS externe nécessite un transfert privé autorisé séparément.

Les blocages commerciaux antérieurs restent : validation phonétique, fidélité artistique, vraie analyse sémantique au-delà des repères locaux, Safari matériel, informations juridiques et exploitation/coûts de production. Aucun paiement activé, aucune dépense, aucun déploiement, aucune fusion ; PR #53 conservée.
