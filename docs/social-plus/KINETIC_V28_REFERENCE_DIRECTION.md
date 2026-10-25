# Social Kinetic V28 : direction issue du master

Le master disponible dans le pack est `EDITPLUS_SOCIAL_KINETIC_V28_BULLES_TIMING_VALIDE.mp4`, horizontal 910 × 512, 41,1 s. Le fichier `.mov` mentionné n'est pas présent. Aucun master ni média utilisateur n'est ajouté au dépôt.

La composition historique `apps/worker/hyperframes/social-kinetic-v28-speech-timed/index.html` reste inchangée. `server/kinetic-reference.mjs` la paramètre pour un nouveau rush : titres à accroche blanche et accent vert, animation mot à mot, sous-titres latéraux, bulles bleues et reflow à deux niveaux. Les anciens médias, paroles et EDL sont retirés de la composition générée. GSAP est chargé localement par le captureur existant.

Le champ facultatif `kineticDirection` du rendu Social Kinetic contient :

- `layout` : rectangles normalisés `hero`, `chat`, `captionLeft`, `captionRight` ;
- `impacts` : `firstWord`, `accentWord`, `lastWord`, éventuellement `holdUntilWord` ;
- `bubbles` : `firstWord`, `lastWord`, `stack` (0 ou 1) ;
- `captionRuns` : `firstWord`, `lastWord`, `side` (`left` ou `right`).

Les indices désignent exclusivement la transcription du rush courant. Aucun champ ne permet d'injecter une citation illustrative inventée. Les erreurs de direction sont rejetées avec HTTP 422 avant mise en file. Le serveur conserve la direction dans la tâche pour les reprises. Les cinq autres modèles et le chemin historique sans cette direction sont préservés. L'interface ne génère pas encore cette direction automatiquement : les repères de ce test sont préparés pour son discours et ses espaces libres, sans détection automatique du visage ou des mains.

## Vérifications du candidat

Rush vertical réel : 27,167 s, 512 × 910, sans recadrage, une piste de voix originale. Trois titres et trois bulles. Décodage MP4 complet et comparaison intégrale du PCM source/sortie réussis. Lecture et téléchargement privés vérifiés dans Chromium. Les 816 images de la composition ont été parcourues : pas de bloc hors écran ni d'intersection entre blocs graphiques visibles. Les 107 mots sont représentés une fois comme sous-titre ou titre ; leur visibilité est contrôlée au milieu de leur intervalle ASR.

Comparaison visuelle effectuée avec le master sur titres, pile de bulles et sous-titres. Les placements portrait sont adaptés à l'espace au-dessus du sujet, pas copiés de la paroi latérale du master. Les polices système utilisées par la composition historique ne constituent pas une certification de l'identité typographique du master.

**Candidat à examiner, pas V28 validée** : cinq mots de faible confiance non résolus et sept avertissements de bornage acoustique, aucune validation phonétique ni Safari physique. L'intégrité de la voix décodée ne démontre pas la fidélité des sous-titres. L'absence d'intersection entre graphismes ne démontre pas l'absence de masque du visage ou des mains. Aucun effet sonore tiers ajouté. Aucun déploiement effectué.
