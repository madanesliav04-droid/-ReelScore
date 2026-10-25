# Connexion de test iPhone — non activée

La V28 est verrouillée par les empreintes de `engines/releases/social-kinetic-v28.json`. Les modules graphiques approuvés ne sont pas modifiés par cette connexion. Le serveur contrôle les empreintes avant la préparation, le lancement et la reprise du rendu.

Le navigateur envoie le vrai fichier à `/api/projects/:id/source`. Après préparation, `/kinetic-direction` retrouve une direction pour ce fichier **et cette transcription**, ou la direction déjà conservée dans une tâche du projet. La direction est envoyée au vrai moteur par `/render`, conservée en SQLite avec la tâche (sans copie supplémentaire des paroles après traitement), puis le MP4 est lu et téléchargé via les routes privées existantes. Aucun export n'est marqué terminé sans fichier. Un ancien tableau d'événements sans direction V28 est rejeté.

**Périmètre actuel :** le rush ayant servi à la validation possède sa direction relue. Un nouveau rush ne récupère jamais ces anciens indices/timings : il nécessite sa propre direction contextuelle dans le champ JSON « Animations avancées ». La génération automatique d'une direction éditoriale pour tout nouveau rush n'est pas réalisée par ce raccordement. La validation visuelle du propriétaire n'est pas une confirmation des mots ASR incertains.

## HTTPS le plus court

Après accord sur le coût : une instance Railway **de test distincte**, avec volume persistant pour SQLite et médias, sert l'interface Social+ actuelle et son API sur une seule origine HTTPS. Les vidéos ne transitent pas par une fonction Vercel. Les sessions `Secure; HttpOnly; SameSite=Strict`, CSRF et contrôles de propriété restent actifs.

Vercel peut rediriger temporairement vers cette origine avec `deploy/https-entry.mjs`. Le projet Vercel conserve sa protection ; le serveur Railway impose séparément l'authentification Social+ et les invitations. Le navigateur finit sur l'adresse Railway : cette solution évite les cookies tiers Safari, conserve le design et n'exige aucun secret dans Vercel. Ce générateur ne déploie rien. Ne pas l'appliquer aux projets ou domaines de production.

Conditions avant activation :

1. Confirmer forfait, crédit restant et plafond Railway dans Usage/Billing : les outils connectés ne donnent pas ces informations. Un crédit inclus ne garantit pas l'absence de surcoût.
2. Autoriser l'instance de test et sa persistance. Le projet `viral-edit` inspecté ne possède que l'environnement production et aucun volume ; aucun de ses services n'est réaffecté automatiquement.
3. Compléter l'image existante avec un environnement Python `faster-whisper==1.2.1` et le modèle Whisper hors ligne. Le Dockerfile général n'installe pas encore ce moteur ASR ; le démarrer tel quel ne suffit pas à la préparation des rushs. Fournir les chemins privés `SOCIALPLUS_ASR_PYTHON`, `SOCIALPLUS_ASR_MODEL_DIR` et, si nécessaire, `SOCIALPLUS_ASR_MODULE_DIR`. Vérifier l'image et la mémoire réelle sur l'instance choisie.
4. Configurer `SOCIALPLUS_ORIGIN` sur l'origine Railway exacte, `NODE_ENV=production`, le propriétaire/MFA et les quotas. Ne pas reprendre les clés Gemini/Supabase des anciens workers pour ce serveur autonome.
5. Vérifier l'installation, le stockage après redémarrage, les accès croisés refusés et les téléchargements Range. Activer uniquement après autorisation, puis faire la recette Safari sur l'iPhone physique.

Aucun hébergement gratuit suffisant n'est confirmé. Aucun service, volume, domaine, environnement Railway ou déploiement Vercel n'est créé par ces fichiers.

## Recette locale reproductible

`SOCIALPLUS_TEST_RUSH` désigne le véritable rush validé ; `SOCIALPLUS_BROWSER_ARTIFACT_DIR` un dossier privé hors dépôt. Configurer le modèle Whisper local, puis exécuter :

```sh
node scripts/kinetic-ui-smoke.mjs
```

Le test utilise un certificat HTTPS local auto-signé accepté uniquement dans son contexte Chromium isolé. Il conserve les cookies sécurisés et l'authentification, mais ne prouve ni la confiance du certificat sur iPhone, ni un test Safari physique. Il n'injecte aucune tâche terminée, transcription, ni sortie vidéo.

La progression affichée correspond aux étapes réellement enregistrées par le moteur (initialisation, composition, export terminé), et non au pourcentage d’images encodées.
