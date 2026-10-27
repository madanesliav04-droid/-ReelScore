# Alex V16 — test Actions complet préparé, transfert privé requis

Branche conservée : `codex/socialplus-actions-free-worker-20261027`.
Commit du workflow : `040ae766d2b1904a7b4a65efc5175d63ca850b05`.
Contrôle réel : https://github.com/madanesliav04-droid/-ReelScore/actions/runs/40565307469

## État exact

Le mode `alex` a été lancé sur le runner standard public Ubuntu 24.04. Il s'est
arrêté **avant toute lecture de média ou installation de moteur** avec :

```text
PRIVATE_DELIVERY_TOKEN_REQUIRED
```

Le contrôle refuse de poursuivre sans canal privé. Source, rendu et livraison
ont été ignorés ; zéro artefact public, zéro MP4 généré par cette exécution.
Le check Cloudflare est `skipped`. Les cinq tests locaux des nouveaux outils
(trois protections de destination privée, deux mesures de vrais sous-processus)
passent. Ils ne valident pas un rendu Alex dans Actions.

## Ce qui est implémenté

1. Accès à un seul dépôt fixé dans le code :
   `madanesliav04-droid/socialplus-ios-private-tests`, avec vérification
   `private == true` avant le téléchargement et chaque envoi.
2. Rush brut déjà présent dans ce dépôt privé : `Resources/fixture.mov`,
   27,166992 s, 512×910, original parlé non monté. Hash SHA-256 fixé et contrôlé :
   `53de1e48bb02b3fa7d086154f374e7f4ca38a346c2305038bc2b211c29d5716a`.
   Aucun nouvel envoi de vidéo demandé au propriétaire.
3. Appel direct du moteur existant `renderAlexV16`, sans la boucle serveur
   Supabase. Transcription faster-whisper locale, planification, trois
   infographies, sous-titres et export FFmpeg. Ni master, ni Gemini, Railway,
   Oracle ou Supabase pour le calcul. Modèles et règles artistiques inchangés.
4. Mesures du groupe de processus : durée et CPU moyen incluant les enfants
   attendus (`wait4`), CPU maximum et RSS agrégé échantillonnés à 200 ms,
   mémoire maximale d'un processus. Le RSS agrégé peut compter les pages
   partagées plusieurs fois et manquer les pointes entre échantillons : ce
   n'est pas un pic physique cgroup exact. 100 % CPU désigne un CPU.
5. Décodage complet, H.264/AAC, une piste audio, empreinte audio bit-identique
   à l'audio original préparé par le pipeline, comparaison des PTS audio,
   fin des pistes audio/vidéo et fenêtres temporelles des mots.
   Cela ne certifie pas la justesse phonétique de la transcription.
6. Livraison MP4, rapport, métriques et preuves uniquement comme assets d'une
   **release brouillon privée** précréée, identifiant `425860214`. Aucun
   `upload-artifact`, cache distant ou publication d'image. Relecture des assets
   envoyés et comparaison de leurs empreintes avant succès de livraison.
7. Le jeton n'est fourni qu'aux étapes de transfert, jamais au calcul. Les
   sorties détaillées du calcul et les paroles restent dans des fichiers
   temporaires privés, puis dans les preuves privées ; elles ne sont pas
   imprimées dans les logs publics. Nettoyage du dossier temporaire en fin de job.

La résolution native est conservée : aucune fausse qualité 1080p ni recadrage
n'est ajouté au rush compressé. Le mode de contrôle conserve `reviewRequired`
et les mots incertains ; un export technique ne devient pas une validation humaine.

## Intervention nécessaire : un secret de livraison limité

Le compte connecté peut lire le dépôt privé et créer sa release brouillon, mais
la création/lecture des secrets Actions du dépôt public est refusée :
`HTTP 403 Resource not accessible by integration` sur l'API des secrets.
Le `GITHUB_TOKEN` du runner public ne peut pas écrire dans un autre dépôt privé.
Il n'est pas remplacé par un jeton global du compte ni par une clé serveur.

Le propriétaire doit donc :

1. Créer un **fine-grained personal access token**, expiration courte (par
   exemple un jour), accès **uniquement** à `socialplus-ios-private-tests`.
2. Accorder **Contents: Read and write** (Metadata en lecture est automatique).
   Aucune permission de facturation, d'administration, de workflow ou d'accès
   au dépôt de production n'est nécessaire pour ce jeton.
3. Dans `-ReelScore` → Settings → Secrets and variables → Actions, ajouter le
   secret `SOCIALPLUS_PRIVATE_DELIVERY_TOKEN`. Ne jamais envoyer sa valeur dans
   le chat, un commit, un commentaire ou un fichier de configuration.
4. Confirmer que le secret est configuré. L'assistant pourra alors relancer le
   mode `alex`, sans réexécuter le premier gate d'infrastructure.

Commande de relance autorisée après configuration :

```bash
gh workflow run 397280720 \
  --repo madanesliav04-droid/-ReelScore \
  --ref codex/socialplus-actions-free-worker-20261027 \
  -f mode=alex
```

Le jeton devra être révoqué/supprimé après le test. La release brouillon n'est
visible que par les comptes autorisés du dépôt privé ; le propriétaire devra
être connecté à GitHub sur son iPhone pour consulter les assets.

## Coût et frontières

Le calcul reste un test logiciel ponctuel sur runner **standard public** (pas
de larger runner ou de calcul privé facturable). Le job est borné à 25 minutes,
le sous-processus de calcul à 20 minutes. Les dépendances et poids publics sont
téléchargés ; aucune API IA payante n'est appelée. Aucun quota d'artefact Actions
n'est consommé par une livraison : elle passe par Releases, dont les limites de
fichiers et bande passante sont documentées séparément.

La facturation globale du compte reste inaccessible : aucune valeur de solde
privé n'est inventée, aucun budget n'est augmenté. Aucun workflow n'est lancé
sur le dépôt privé. Aucun média n'est ajouté au code Git.

Ce test ne valide pas encore CPU/RAM/temps d'un vrai montage Actions, fidélité
visuelle, paroles exactes ou intégration iPhone. Le raccordement à l'interface
ne sera étudié comme parcours réel qu'après le succès du rendu et de sa livraison.
Il devra garder les credentials côté serveur, l'authentification, la propriété
des fichiers et les quotas ; Actions ne doit pas être détourné en hébergement
permanent ou service de calcul commercial contraire aux conditions GitHub.

Sources :

* https://docs.github.com/en/actions/concepts/billing-and-usage
* https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
* https://docs.github.com/en/rest/releases/assets
* https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
