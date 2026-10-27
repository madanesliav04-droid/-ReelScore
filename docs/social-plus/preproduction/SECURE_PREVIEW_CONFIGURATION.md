# Configuration privée — Social+

Le propriétaire confirme le bucket existant `socialplus-videos` et son accès
public désactivé. Cette information est déclarative : aucun contrôle Cloudflare
authentifié n'a encore été possible. Ne créer ni bucket, ni service, ni domaine
public pour contourner cette absence d'accès.

## Où placer les valeurs

1. **Environnement sécurisé de la tâche** : utiliser son gestionnaire de secrets
   s'il est disponible. Sinon, utiliser un fichier privé hors du dépôt, par exemple
   `/workspace/private/socialplus-r2.env` (répertoire 700, fichier 600).
   Le modèle sans secrets est `deploy/socialplus-beta/r2-transfer.env.example`.
   Remplir `R2_ACCOUNT_ID`, `R2_BUCKET_NAME=socialplus-videos`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` et `CLOUDFLARE_API_TOKEN` directement
   dans cette interface sécurisée ou ce fichier, jamais dans le chat, une issue,
   un commit, une commande contenant la valeur ou les logs. Le jeton Cloudflare
   doit permettre la lecture des paramètres R2 du compte existant ; la clé S3 doit
   être limitée en lecture/écriture d'objets à ce seul bucket. Aucun droit de
   création de service n'est nécessaire. Ne pas réutiliser une clé globale.
2. **GitHub Actions** : les clés R2 et le jeton Cloudflare ne vont PAS dans le
   runner. Après vérification des accès, seuls les liens temporaires et leur
   manifeste validé vont dans le secret `SOCIALPLUS_R2_TRANSFER`, via le dépôt
   `-ReelScore` → Settings → Secrets and variables → Actions → New repository
   secret. Cette connexion ne peut pas configurer ce secret (HTTP 403).
   Ne jamais utiliser un input workflow, un fichier suivi ou un artefact public.
   Le workflow de transfert est préparé sur
   `codex/socialplus-actions-free-worker-20261027`, distinct de cette PR.
   Ne lancer aucune exécution avant validation réelle des accès et quotas.
3. **Vercel** : projet isolé `socialplus-beta-interface` → Settings → Environment
   Variables → sélectionner Preview uniquement. Configurer l'URL et la clé
   **publique** du backend isolé, `NEXT_PUBLIC_SOCIALPLUS_ALEX_ONLY=true` et
   `NEXT_PUBLIC_ALEX_V16_REVIEW_ENABLED=true`. Aucune clé R2, clé service-role ou
   clé Gemini ne doit porter le préfixe NEXT_PUBLIC ni apparaître côté navigateur.
   Settings → Build and Deployment : Root Directory `viral-studio`, Framework
   Preset Next.js. Ne pas modifier les variables Production ni promouvoir un build.

Ne pas afficher le fichier avec `cat`, ne pas activer `set -x`, ne pas lancer
`env`/`printenv`. Le fichier privé peut être chargé par Node avec
`--env-file=/workspace/private/socialplus-r2.env` ; le nom du fichier est public,
ses valeurs ne le sont pas. Les signatures réelles expirent après une heure et
portent sur un objet/méthode précis ; elles restent réutilisables jusqu'à expiration.
Le bucket doit rester privé. Les domaines R2 et les éventuels proxies Workers
doivent être vérifiés ; l'expiration d'un lien ne supprime pas l'objet stocké.

## Ce qui reste indépendant de R2

Le build Next.js, les tests de proxy/navigation, le rendu local Alex et les mesures
vidéo n'ont besoin d'aucun identifiant R2. Le stockage Supabase privé existant est
pris en charge par le code et peut servir à la bêta si un backend **isolé** avec
Auth, stockage et worker est accessible et sa gratuité vérifiée. R2 n'est donc
pas un prérequis absolu au déploiement de l'application connectée.

Il manque toujours un backend distant isolé validé et ses paramètres pour livrer
un parcours iPhone complet. Ne pas remplacer ce backend par l'instance de
production, ni publier une interface statique comme preuve de montage fonctionnel.

## Vérifications supplémentaires exécutées

- Neuf tests supplémentaires des garde-fous coût/isolation et de la télémétrie :
  neuf réussis, aucun échoué. Les plans de facturation utilisés sont des fixtures ;
  cela ne vérifie pas la facturation réelle d'un compte.
- Build réel avec `VERCEL_ENV=preview` et variables backend absentes : échec
  **attendu et vérifié** contenant le diagnostic de backend isolé manquant, avant
  tout déploiement. Le garde-fou empêche le retour silencieux vers la production.
- Aucun accès R2 ni upload, nouveau rendu ou workflow Actions lancé à cette étape.
