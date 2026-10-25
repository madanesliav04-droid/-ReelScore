# Aperçu privé de l’interface Social+

Cet aperçu statique réutilise l’index, les styles, la navigation et le catalogue de l’application existante. Il propose Accueil, Montage, Analyse et Projets, la sélection des six modèles, la lecture locale d’une vidéo et sa réutilisation entre Montage et Analyse.

**Il ne constitue pas une bêta de traitement vidéo hébergée.** Aucun serveur n’est connecté : aucun fichier envoyé, aucun compte Social+ créé, aucun projet sauvegardé, aucun montage ou analyse exécuté, aucun score affiché et aucun avis prétendument transmis. Les actions indisponibles sont désactivées et expliquées dans l’interface. La protection de déploiement Vercel impose une connexion au compte Vercel autorisé ; elle est distincte des invitations de l’application fonctionnelle.

```bash
node apps/socialplus/preview/build.mjs
SOCIALPLUS_TEST_RUSH=/chemin/vers/video.mov node apps/socialplus/preview/verify.mjs
```

Le build sélectionne uniquement quatre fichiers statiques. Le déploiement ajoute `preview/vercel.json` : aucun secret, média utilisateur, moteur Python, base SQLite ou fonction serveur n’est envoyé. Aucune offre payante, analytics tiers ou service de stockage n’est activé.

## Déploiement isolé du 25 octobre 2026

- Équipe DCEO, offre **Hobby** vérifiée via le contexte Git Vercel.
- Projet isolé `socialplus-beta-interface` : `prj_Wkh4h5DSZo3bPfeEMvX7elWkvCZt`.
- Protection Vercel Authentication activée avant envoi (`all_except_custom_domains`), aucun domaine personnalisé, sources privées.
- Le premier envoi a été demandé avec `target: staging`. Vercel l’a néanmoins classé `production` et l’a automatiquement associé aux domaines du nouveau projet : `dpl_GZLDDEKUmqxgJjzPKWj2AYUw6tEz`.
- L’annulation a échoué, le déploiement étant déjà prêt. Le projet a été immédiatement **mis en pause** pour bloquer cette publication. Aucun projet ou environnement existant de Social+ ou MyPulse n’a été modifié.
- L’attribution automatique des domaines a ensuite été désactivée. Le second envoi est bien `target: staging`, mais **BLOCKED** du fait de la pause : `dpl_BJRFsvno5rfGpiLuJAatrJAbdj6n`.
- L’aperçu n’est donc pas déclaré accessible. La réactivation du projet réactiverait aussi son premier déploiement classé production ; l’accord explicite du propriétaire est requis avant cette opération. Aucun contournement de la pause ou de l’authentification.
- Safari physique non exécuté. La vérification locale Chromium mobile couvre la navigation, les six choix, la lecture d’un vrai rush, la réutilisation locale, l’absence d’envoi de fichier et six largeurs sans débordement.

Pour ouvrir une véritable bêta de montage/analyse, il reste à raccorder un serveur capable de conserver SQLite, les médias et les tâches en arrière-plan avec FFmpeg, Python, Whisper et Chromium. L’aperçu statique ne remplace pas ce serveur et ne tente pas de le simuler.
