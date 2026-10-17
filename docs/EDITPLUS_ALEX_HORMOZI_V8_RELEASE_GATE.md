# Edit+ — Alex Hormozi V8 | Gate de commercialisation

**Décision produit :** V8 est la seule version susceptible d'être commercialisée. V7 reste la référence artistique verrouillée; ne pas commercialiser V7.

## Implémenté dans la branche V8
- Conservation du style Apple Kinetic V7 : sous-titres flottants, sans panneaux, animations déclenchées par des mots horodatés
- Rendu du calque transparent via HyperFrames WebM explicite, décodeur alpha VP9 au compositing, vidéo H.264 et piste source AAC unique
- Placement responsive des sous-titres, 16:9 et 9:16, en zones sûres sans cartouches
- Remapping des mots après cuts, détection de décalage de timeline et groupes sans superposition
- Refus des transcriptions absentes, incohérentes ou anormalement lacunaires
- Refus d'une conversion forcée paysage/portrait, audio original obligatoire
- Contrôles FFprobe, décodage intégral, signalements noir/freeze/silence/pics sur les exports V8
- Tests CI de rendu transparent et de piste audio unique sur matériel synthétique
- Staging activable par `ENABLE_ALEX_V8_WORD_SYNC=staging` et `ENABLE_HYPERFRAMES_RENDER=true`
- Déploiement public impossible sans **les deux** drapeaux `ENABLE_ALEX_V8_WORD_SYNC=production` et `ENABLE_ALEX_V8_PUBLIC=true`

## Interdictions
- Ne jamais annoncer « transcription exacte » à partir des seuls timecodes fournisseur
- Ne jamais utiliser des mots fictifs, inventer des preuves, déclencher des objets avant l'énoncé
- Ne jamais créer de doublage IA, de deuxième piste vocale ou de B-roll générique
- Ne jamais réorienter une source horizontale en portrait ni changer le cadrage sans raison
- Ne pas fusionner V8 en production avant réussite des tests réels ci-dessous

## Critères de sortie obligatoires
1. **E2E rush original :** passer le rush utilisateur `IMG_0506.mp4`, 44,5 s, dans le même worker que celui destiné à la production; obtenir des words Gemini réellement horodatés et leur provenance.
2. **Fidélité discours :** comparer à l'audio original en écoute continue et vérifier chaque mot/temps, y compris l'expression « aider quelqu'un », jamais anticipée à l'image.
3. **Export complet :** visualiser et écouter le vrai rendu V8, y compris tous les cuts et changements de fond; contrôler absence de freeze, silence inattendu, doublage, sous-titre tronqué ou avance visuelle.
4. **Trois rushes distincts :** B (paysage), A (portrait) et C (tableau portrait); ne pas changer le ratio natif et garder gestes, visage, écritures.
5. **Débit/robustesse :** vérifier erreurs Gemini, rendus répétés sur la même source, état utilisateur en cas d'échec, coût et temps réel par vidéo.
6. **Critère commercial :** aucun défaut bloquant sur les trois rushes et aucune revendication « 100/100 » sans évaluation de qualité indépendante.

## Verdict
**V8 = release candidate technique**; la marque « modèle commercialisé » reste BLOQUÉE tant que les 6 critères précédents ne sont pas réellement vérifiés. Les tests synthétiques seuls n'autorisent pas la bascule.
