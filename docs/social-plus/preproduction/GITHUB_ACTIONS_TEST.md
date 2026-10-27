# Social+ — test ponctuel GitHub Actions, 27 octobre 2026

## Résultat réel

Branche isolée : `codex/socialplus-actions-free-worker-20261027`.
Commit testé : `2e6e1cc9616149fa3847878e17447d509b4b2217`.
Exécution : https://github.com/madanesliav04-droid/-ReelScore/actions/runs/40558830817

Le job GitHub hébergé standard `ubuntu-24.04` x64 a réussi en **51 secondes** :

* Node 24.21.0, installation par lockfile, syntaxe et **77 tests Node réussis**.
* FFmpeg a encodé puis décodé un vrai MP4 synthétique d'une seconde H.264/AAC,
  avec une piste vidéo et une piste audio.
* Le bundle Remotion 4.0.530 a sélectionné une composition de contrôle et rendu
  un PNG 320×180 avec **Chromium 149.0.7790.0** (5 761 octets).
* Aucun secret Supabase, Gemini ou R2 fourni. Le token automatique GitHub est
  limité à la lecture du code/métadonnées, sans authentification Git persistante.
* Aucun cache Actions enregistré, artefact téléversé, conteneur publié ou service
  déployé. Les fichiers synthétiques ont été supprimés du répertoire temporaire.

**Ce n'est pas encore un MP4 Alex V16 ni un parcours utilisateur authentifié.**
Les preuves expurgées sont dans `actions-secret-free-evidence.log` et les statuts
API dans `actions-secret-free-results.json`.

## Coût et isolation vérifiés

Le dépôt est **public**. GitHub documente les runners hébergés **standards**
comme gratuits et illimités dans les dépôts publics, sous réserve des conditions
d'usage. Les larger runners restent facturables : aucun n'est utilisé ici.
Les minutes incluses pour les dépôts privés ne déterminent donc pas le coût
de cette exécution publique standard.

La lecture du compte `users/madanesliav04-droid/settings/billing/usage` et des
paramètres administratifs Actions renvoie **HTTP 403, Resource not accessible
by integration**. Le plan, les budgets, les dépenses globales, le quota privé
restant et la consommation globale de stockage ne sont pas présentés comme lus.
Le test ne téléverse ni artefact ni cache et n'augmente aucun plafond.

L'exécution manuelle a été autorisée et a réellement abouti. Le workflow se
limite à ce dépôt public et à cette branche, utilise un seul job, un délai de
15 minutes et des actions épinglées par SHA. Aucun secret de backend n'est
référencé dans le YAML.

Les commits portent `[skip ci]` pour éviter les builds automatiques Cloudflare
et les workflows push. Le test est lancé **manuellement** via `workflow_dispatch`,
sur un chemin de workflow déjà enregistré. Le check Cloudflare du commit testé
est **skipped** et l'API GitHub retourne zéro déploiement pour ce commit. Vercel
ne possède pas de projet Git lié à ce dépôt dans le contexte connecté vérifié.
Ni la branche de la PR #58, ni `main`, ni la configuration de production ne sont
modifiés. Ne pas fusionner ce workflow de test dans une branche de déploiement.

Pour relancer uniquement ce test :

```bash
gh workflow run 397280720 \
  --repo madanesliav04-droid/-ReelScore \
  --ref codex/socialplus-actions-free-worker-20261027
```

## Possibilité d'un véritable MP4 Alex V16 ponctuel

**Techniquement envisageable, pas encore exécuté dans Actions.** Le chemin
`apps/worker/src/alex-v16-pipeline.js` peut être appelé directement sans lancer
la boucle Supabase du serveur. Il utilise le rush local, FFmpeg, le plan Alex
existant, Pillow et la transcription locale faster-whisper small INT8. Il ne
nécessite ni Gemini ni clé Supabase pour un rendu hors ligne.

Une prochaine exécution de test devra :

1. Installer les dépendances Python existantes, vérifier les poids publics
   Whisper par les hashes du manifest existant ; aucun service IA facturé.
2. Utiliser un rush parlé non personnel explicitement autorisé, ou préparer un
   transfert privé autorisé. Ne pas copier les rushs personnels du workspace
   dans le dépôt public, ses logs ou ses artefacts.
3. Appeler le moteur Alex existant, sans master déjà monté, et conserver les
   mentions de transcription à vérifier. Le probe Remotion n'est pas ce moteur.
4. Contrôler MP4, durée, dimensions, audio, sous-titres et fidélité ; mesurer
   CPU/RAM/disque et durée du rendu réel, pas extrapoler depuis les 51 secondes.
5. Prévoir avant lancement la récupération du MP4. Un artefact sur ce dépôt
   public n'est pas un espace de livraison privé. Les quotas et la facturation
   du dépôt privé de tests devraient être vérifiés avant de l'utiliser ; son
   existence seule ne démontre pas des minutes gratuites disponibles.

## Les trois frontières

| Catégorie | Conclusion |
|---|---|
| Fonctionne gratuitement et vérifié | Tests worker, FFmpeg H.264/AAC, bundling Remotion et véritable rendu Chromium sur runner standard public, sans backend |
| Aucun backend externe nécessaire au calcul hors ligne | Le moteur Alex direct peut utiliser Python/FFmpeg/Whisper local ; la génération Alex dans Actions reste à exécuter. npm/GitHub et le modèle public sont des sources de téléchargement |
| Services persistants nécessaires à l'application | Authentification, stockage privé source/résultat, projets, file de jobs, API autorisant le déclenchement et la progression ; Actions ne les fournit pas comme backend applicatif permanent |
| Bloque une utilisation durable par de vrais utilisateurs | VM éphémère et fichiers supprimés, délais de queue sans promesse de démarrage, limites/concurrence/API, confidentialité des logs/artefacts publics, absence d'endpoint applicatif permanent et de stockage utilisateur |

Les runners standards publics annoncés sont 4 CPU, 16 Go RAM et 14 Go SSD ; ce
sont les caractéristiques de l'offre, pas des performances Alex mesurées.
GitHub limite chaque job hébergé à six heures ; ce workflow impose quinze
minutes. Les quotas de stockage des artefacts restent distincts et partagés
avec Packages. Aucun artefact n'est ajouté par ce test.

Actions convient ici à la validation du logiciel. Les conditions GitHub
restreignent notamment l'utilisation comme application serverless ou service
commercial fournissant Actions. Ce test ne valide donc pas Actions comme
hébergement de Social+ ou comme moteur permanent derrière ses utilisateurs.

Sources officielles :

* https://docs.github.com/en/actions/concepts/billing-and-usage
* https://docs.github.com/en/billing/concepts/product-billing/github-actions
* https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job
* https://docs.github.com/en/actions/reference/limits
* https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
* https://github.com/cloudflare/workers-sdk/discussions/13216
