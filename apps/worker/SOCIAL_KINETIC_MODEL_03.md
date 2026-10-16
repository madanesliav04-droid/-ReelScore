# Edit+ — Modèle 03 : SOCIAL KINETIC
**Référence utilisateur :** `ScreenRecording_10-16-2026 16-17-09_1.mp4` (55,17 s, capture Instagram, vidéo centrale paysage). Pas de réutilisation de l'interface Instagram comme composant d'Edit+.

## Direction artistique verrouillée
- Facecam / plan réel dominant, structure de montage sobre.
- Accroche en mots typographiques directement sur l'image, pas de cadres lourds.
- Animations typographiques courtes, modernes et déclenchées par le sens.
- Bulles bleu vif uniquement sur des extraits effectivement prononcés, **jamais présentées comme de vrais DM**.
- Chiffres et tarifs à l'écran exclusivement quand ils sont réellement prononcés; zéro chiffre inventé.
- Mots de valeur et séquences numérotées exprimées avec mouvements discrets.
- Couleurs contrastées adaptées au décor après validation visuelle ; respect du sujet et du format natif.
- Cuts et punch-ins seulement si utiles, effets audio discrets; pas de boucle d'animations décoratives.

## Analyse de la référence (repères de la capture, approximatifs)
- 0–4 s : hook typographique, mot/numéro mis en avant.
- 9–16 s : bulles de message bleues, empilées puis effacées.
- 18–28 s : micro-accents et mots-clés intégrés au décor.
- 30–42 s : prises de parole avec infographies légères et valeurs.
- 45–51 s : quantités (« 3 000 € », puis « 1 000 € ») clairement mises en avant.
Ces observations portent sur les animations visibles, pas sur une transcription vérifiée de la vidéo de référence.

## Mise en œuvre sur la branche dédiée
- `apps/worker/src/social-kinetic-v1.js` : sélection des événements à partir des mots horodatés et d'une preuve indépendante de zone libre dans l'image; génération d'animations ASS.
- `apps/worker/src/edit.js` : modèle `social_kinetic` intégré aux styles, contrats, légendes et timelines.
- `apps/worker/src/render.js` : routage dédié au rendu ASS, distinct du style generic impact.
- `apps/worker/tests/social-kinetic-v1.test.mjs` : tests de vérification, prévention de chevauchements et montage.
- `editplus/quality/subtitle_truth_gate.py` : contrôle commun des sous-titres déjà développé sur la branche de base.

## Sécurité éditoriale
Le modèle n'affiche **aucune** donnée ou insertion cinétique si la transcription n'est pas accompagnée de `alignment.method=forced_alignment`, `alignment.verified=true`, confiance ≥0,92 et d'une preuve indépendante de composition `composition_proof`. Pour la zone graphique haute, cinq images échantillonnées minimum, confiance ≥0,90 et espace libre supérieur à 24 % de la hauteur sont exigés.

Les montages de ce type ne doivent pas mentir sur les conversations privées, les performances ou les chiffres. Si la phrase n'est pas prouvée, l'effet est rejeté.

## État et prochaine frontière
- **Implémenté sur une branche de développement**, non fusionné dans la branche déployée sur Railway.
- **7/7 tests unitaires + smoke test d'intégration timeline/rendu ASS passés localement en JS.**
- Aucun test bout-en-bout indépendant n'a encore rendu des vidéos de 2–3 personnes inconnues en production. La qualité premium et l'autonomie ne sont donc **pas certifiées**.
- L'étape de mise en ligne suppose : alignement audio mot-à-mot réel, analyse image de zones libres, QA visuelle et validation de la version remotion/FFmpeg sur un rush inconnu, puis intégration de l'option au sélecteur de modèles.
