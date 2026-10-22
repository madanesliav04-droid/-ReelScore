# Social+ V18 — version privée

L’application testable se trouve dans [apps/socialplus](apps/socialplus/README.md). Elle utilise trois écrans, des accès sur invitation et des traitements locaux persistants, sans déploiement de production ni service payant supplémentaire.

- [Lancement Windows](docs/social-plus/WINDOWS_LOCAL.md)
- [Rapport V18 : 97 scénarios](docs/social-plus/V18_ACCEPTANCE_REPORT.json)
- [Sources encore nécessaires](docs/social-plus/MISSING_SOURCES.md)

Les instructions ci-dessous décrivent l’application historique conservée ; elles ne sont pas le lancement de la V18 locale.

---

# Viral+

Viral+ analyse une vidéo courte avant publication et évalue son potentiel de recommandation à partir d'un référentiel Meta/Instagram versionné et d'heuristiques Viral+ clairement séparées.

## Backend sécurisé

Le frontend est hébergé sur GitHub Pages. Le backend d'analyse est un Cloudflare Worker qui transmet temporairement la vidéo à Gemini, récupère le diagnostic, puis supprime le fichier Gemini.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/madanesliav04-droid/-ReelScore/tree/main/cloudflare-worker)

Pendant le déploiement, renseigne le secret `GEMINI_API_KEY`. Une clé peut être créée dans Google AI Studio : https://aistudio.google.com/apikey

Le Worker autorise uniquement l'origine `https://madanesliav04-droid.github.io` et charge le référentiel courant depuis `meta-rules.json`.

