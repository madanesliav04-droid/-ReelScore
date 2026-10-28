# Social+ — Sources retrouvées : Alex Hormozi & Social Kinetic

Date d'inventaire : 21 octobre 2026. **Lecture seule : aucun changement de production, aucune fusion.**

## Statuts validés par l'utilisateur

- **Alex Hormozi** : référence visuelle/montage validée ; master vidéo de référence V16 : `EDITPLUS_HORMOZI_V16_B_PLEIN_ECRAN_V11_RESTAUREE.mp4`, dans `EDITPLUS_HORMOZI_V16_RETOUR_V11_PACK.zip` (Library).
- **Social Kinetic** : modèle validé ; master vidéo V28 : `EDITPLUS_SOCIAL_KINETIC_V28_BULLES_TIMING_VALIDE.mp4` (Library).

**Attention :** validation des vidéos ≠ test validé d'un moteur autonome sur n'importe quel nouveau rush.

## Référentiel GitHub

Repo : <https://github.com/madanesliav04-droid/-ReelScore>

### Alex Hormozi — code de direction et de rendu

Branche : `editplus-alex-reference-lock-20261017`
- [hormozi-omni-director.js](https://github.com/madanesliav04-droid/-ReelScore/blob/editplus-alex-reference-lock-20261017/apps/worker/src/hormozi-omni-director.js) — plan de scènes, références et timings. Git blob SHA `b8170e7e2242d0343f729182d0e2f77ac97b6748`.
- [hormozi-omni-render.js](https://github.com/madanesliav04-droid/-ReelScore/blob/editplus-alex-reference-lock-20261017/apps/worker/src/hormozi-omni-render.js) — générateur d'animations ASS. Git blob SHA `6988c6521d7ce151f1846358963ae7e6112da6a0`.
- [hormozi-beat-timing.js](https://github.com/madanesliav04-droid/-ReelScore/blob/editplus-alex-reference-lock-20261017/apps/worker/src/hormozi-beat-timing.js) — rythme/timing.
- [Règles de référence](https://github.com/madanesliav04-droid/-ReelScore/tree/editplus-alex-reference-lock-20261017/apps/worker/hyperframes/four-creators/references/alex-hormozi-20261017).
- [Autre implémentation, Alex V8](https://github.com/madanesliav04-droid/-ReelScore/blob/editplus-alex-v8-release-candidate-20261017/apps/worker/src/alex-v8-release.js) — candidat release; **ne pas confondre avec master V16**.

**Limite vérifiée :** le `hormozi-omni-director.js` contient des conditions de blocage sur alignement de la parole et une liste `notValidated`. Le code trouvé n'est pas à lui seul la preuve qu'il reproduit exactement la vidéo V16 validée.

### Social Kinetic V28 — code complet de prototype et tests

Branche de travail : `editplus-integrate-social-kinetic-v28-20261018`
- [social-kinetic-v28-engine.js](https://github.com/madanesliav04-droid/-ReelScore/blob/editplus-integrate-social-kinetic-v28-20261018/apps/worker/src/social-kinetic-v28-engine.js) — plan + composition HTML (blob SHA `359f84ce5a153c481948d93681b9f57033ebcdc5`).
- [social-kinetic-v28-runtime.js](https://github.com/madanesliav04-droid/-ReelScore/blob/editplus-integrate-social-kinetic-v28-20261018/apps/worker/src/social-kinetic-v28-runtime.js) — rendu HyperFrames + FFmpeg (blob SHA `aaeaa681523fe02c0f49d4848fd2bf868be48d27`).
- [Tests d'intégration V28](https://github.com/madanesliav04-droid/-ReelScore/blob/editplus-integrate-social-kinetic-v28-20261018/apps/worker/tests/social-kinetic-v28-integration.test.mjs) (blob SHA `04cc2261ed35d9da9fb13ab774abcb0228d0240b`).
- [Composition HyperFrames V28](https://github.com/madanesliav04-droid/-ReelScore/tree/editplus-integrate-social-kinetic-v28-20261018/apps/worker/hyperframes/social-kinetic-v28-speech-timed).
- [Branche complète V28](https://github.com/madanesliav04-droid/-ReelScore/tree/editplus-integrate-social-kinetic-v28-20261018).

**Limite vérifiée :** runtime V28 protégé par `ENABLE_SOCIAL_KINETIC_V28=staging` et `ENABLE_HYPERFRAMES_RENDER=true`. Le moteur peut renvoyer `STAGING_QA_REQUIRED`, et l'engine indique `previewOnly:true` ; cela confirme qu'il s'agit d'une implémentation source réelle mais encore soumise à une recette technique avant production.

## État du déploiement vu en lecture seule

Railway projet `viral-edit`, service `video-worker` : branche GitHub `socialplus-auth-same-origin-20261019`. La liste des fichiers de cette branche **ne contient pas** les modules `social-kinetic-v28-*` ni `hormozi-omni-*`. Les deux implémentations retrouvées sont dans les branches de développement précitées, pas confirmées intégrées à cette branche de production.

## Pour Codex / Work — intégration sûre

1. Conserver les masters validés V16 et V28 comme références de comparaison (ne pas remplacer leurs rendus).
2. Reprendre les branches GitHub exactes et leurs dépendances (pas seulement les 4 fichiers principaux).
3. Comparer avec la branche effectivement déployée ; intégrer par PR ciblée, sans rétablir d'anciens presets.
4. Valider synchronisation des mots, audio original unique, cuts, bulles/animation, safe zones, formats natifs et exports sur nouveaux rushs.
5. Exécuter les tests automatiques, puis tests MP4 réels et recette visuelle. Ne pas marquer autonome/commercial sans réussite observée.
