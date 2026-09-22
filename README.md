# Viral+

Viral+ analyse une vidéo courte avant publication et évalue son potentiel de recommandation à partir d'un référentiel Meta/Instagram versionné et d'heuristiques Viral+ clairement séparées.

## Backend sécurisé

Le frontend est hébergé sur GitHub Pages. Le backend d'analyse est un Cloudflare Worker qui transmet temporairement la vidéo à Gemini, récupère le diagnostic, puis supprime le fichier Gemini.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/madanesliav04-droid/-ReelScore/tree/main/cloudflare-worker)

Pendant le déploiement, renseigne le secret `GEMINI_API_KEY`. Une clé peut être créée dans Google AI Studio : https://aistudio.google.com/apikey

Le Worker autorise uniquement l'origine `https://madanesliav04-droid.github.io` et charge le référentiel courant depuis `meta-rules.json`.
