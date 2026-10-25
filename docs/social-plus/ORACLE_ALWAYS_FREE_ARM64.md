# Social+ sur Oracle ARM64 — préparation isolée, aucune activation automatique

## Décision et limites de cette livraison

Conserver l’application web/PWA, Node 24, SQLite, authentification propriétaire/MFA, six moteurs et leurs ressources. Un conteneur applicatif sert interface et API ; Caddy expose cette **même origine HTTPS**, sans Vercel ni Railway. L’iPhone reste un client ; FFmpeg, Python, Whisper et Chromium tournent sur la VM, indépendamment du PC.

Cette procédure prépare un nouvel environnement de test. Elle ne déploie rien. Ne lancer les commandes d’activation qu’après validation des résultats ARM et des quotas du compte Oracle. Aucun média personnel ni secret n’entre dans l’image ou le dépôt public. Le premier contrôle ARM utilise exclusivement une mire et un son artificiels.

**Limites fonctionnelles conservées :**

- V28 exige une direction contextuelle vérifiée. Le rush vertical approuvé et ses mots peuvent retrouver la direction verrouillée ; un rush différent ou une transcription différente ne l’obtient pas automatiquement. Aucun preset générique n’est substitué. Le placement/découpage éditorial autonome sur n’importe quel nouveau rush reste incomplet.
- Les cinq autres modèles restent conservés avec leurs statuts existants ; aucune nouvelle certification artistique.
- L’orchestrateur actuel exécute un calcul à la fois et conserve ses descripteurs SQLite pour la reprise. Une nouvelle demande pendant un calcul peut recevoir `RENDER_BUSY` (409). **Ce n’est pas encore une FIFO multiutilisateur acceptant toutes les soumissions.** Pour le premier test, un seul testeur ; cette admission doit être complétée avant une bêta simultanée.
- Import plafonné à 100 Mo au proxy, 1 Go de médias par utilisateur et six opérations de calcul par jour par utilisateur. Analyse, transcription et rendu consomment ce quota ; six ne signifie pas six parcours complets. Un rendu n’est terminé qu’après vérification du fichier.
- Pas d’upload reprenable après coupure réseau. Redémarrage : reprise persistée, avec limite de tentative existante.
- Les anciens médias de projets sauvegardés ne sont pas effacés arbitrairement. Nettoyage automatique des répertoires de rendu abandonnés de plus de 24 h durant maintenance hors ligne ; nettoyage des fichiers orphelins générés par l’application à son redémarrage. Suppression utilisateur existante conservée. La rétention générale des projets enregistrés n’est pas ajoutée.
- Les avertissements de transcription restent à relire/écouter. Ni les timestamps Whisper ni un test synthétique ne certifient une précision phonétique ou une fidélité artistique.

## Gratuité à vérifier dans VOTRE compte

Documentation officielle consultée le 25 octobre 2026 :
https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

- Ampere A1 : **1 500 heures OCPU/mois et 9 000 heures Go/mois**, équivalent 2 OCPU / 12 Go. À 31 jours : 1 488 heures OCPU et 8 928 heures Go pour UNE VM 2/12. Tous les usages A1 du compte se cumulent ; pas de seconde VM de test en parallèle.
- Volumes bloc : 200 Go cumulés boot + données, dans la région d’origine ; cinq sauvegardes de volume incluses selon les conditions actuelles. Proposition : UN disque boot de 100 Go ; aucun volume supplémentaire provisionné ici.
- Sortie réseau : quota Always Free annoncé 10 To/mois ; vérifier l’éligibilité et la consommation globale du compte.
- **Pas de garantie de disponibilité** : capacité A1 parfois indisponible ; Oracle peut récupérer une instance gratuite inactive. Ne pas générer une charge artificielle pour éviter la récupération.
- 0 € est une cible conditionnelle, pas une facture mesurée ni un SLA. Une alerte budget Oracle n’est pas un plafond empêchant les dépenses. Ne pas activer Pay As You Go, ne pas acheter de capacité, ne pas créer de forme payante comme remplacement. Une ressource offerte temporairement par les crédits d’essai n’est pas nécessairement Always Free.

Aucun NAT Gateway, load balancer, base managée, registre privé payant, stockage objet, adresse supplémentaire ou sauvegarde cloud n’est créé par les fichiers préparés. Vérifier également le coût affiché de l’IP publique et du réseau choisis dans votre console ; ne pas valider si un poste payant reste affiché.

## Ce que vous devez faire pour ouvrir le compte et autoriser le test

1. Ouvrir le site officiel https://www.oracle.com/cloud/free/ avec vos coordonnées réelles. Oracle peut demander téléphone, carte et vérification/autorisation bancaire temporaire ; ne jamais envoyer ici la carte, un mot de passe ou un code MFA. S’arrêter si l’inscription demande un achat ou abonnement.
2. Choisir soigneusement la **région d’origine**, où les ressources Always Free sont éligibles. La disponibilité réelle A1 n’est pas garantie avant inscription ; ne pas choisir de ressource payante si elle manque.
3. Activer MFA sur le compte. Rester sur la formule gratuite, sans mise à niveau payante. Vérifier quotas et autres ressources existantes.
4. Préparer une clé SSH depuis Windows PowerShell (`ssh-keygen -t ed25519`). La clé privée reste sur votre matériel ; seule la clé publique va dans OCI. Aucun besoin de transmettre les identifiants Oracle ou un accès administrateur général.
5. Prévoir un **nom d’hôte de test sur un domaine déjà possédé** et son DNS A vers l’IP de la VM. Aucun domaine n’est acheté. Sans nom d’hôte/certificat public approuvé, le HTTPS Safari distant reste à configurer ; une IP HTTP n’est pas un remplacement.
6. Après résultats ARM satisfaisants, confirmer séparément la création de la VM Always Free **VM.Standard.A1.Flex, 2 OCPU, 12 Go, Ubuntu 24.04 ARM64, boot 100 Go**. Ne pas activer avant cette validation. Sauvegarder la capture récapitulative d’éligibilité/coût dans votre espace privé.
7. Réseau : sous-réseau public + Internet Gateway, aucun NAT. Entrée SSH 22 limitée à votre IP ; TCP 80/443 (et UDP 443 facultatif) pour HTTPS. Ne jamais exposer 4318, SQLite ou un socket Docker. Conserver le pare-feu hôte et la Security List/NSG ; autoriser les mêmes ports aux deux niveaux, avec règles IPv6 équivalentes si IPv6 activé.
8. Pour une intervention de déploiement assistée ultérieure : accès SSH restreint à cette VM/ce compartiment via un mécanisme de connexion sécurisé pris en charge. Aucun accès Oracle n’est configuré dans la session actuelle ; ne pas coller de clé privée dans la conversation.

## Compatibilité ARM : méthode et critères

Le profil `apps/socialplus/deploy/Dockerfile.oracle-arm64` emploie Node 24 Debian bookworm, Chromium et FFmpeg Debian natifs, Python 3.11, Pillow/NumPy, GSAP/Playwright existants. Pas de binaire Chromium x86 téléchargé par Playwright : chemin `/usr/bin/chromium`.

`faster-whisper==1.2.1` est conservé. CTranslate2 4.8.3 (même version que le précédent environnement local), ONNX Runtime 1.31.0 et PyAV 16.0.1 sont sélectionnés avec wheels Python 3.11 ARM64 disponibles sur PyPI. PyAV diffère de la version Python 3.12 précédente ; l’audio est déjà décodé par FFmpeg dans le script existant. Poids Whisper small inchangés, SHA-256 `3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671`. Aucun changement du script ASR ou des moteurs graphiques.

Le test natif sur runner GitHub standard `ubuntu-24.04-arm`, dans le dépôt déjà public, ne contient que code public, poids publics, mire et son artificiels. Il ne déploie ni ne publie l’image et n’utilise ni cache ni artefact. Exécution limitée à 2 CPU / 9 Gio RAM ; ce n’est pas un benchmark de processeur Ampere Oracle. Contrôles : arch ARM64, Node 24, verrou V28, vrai rendu Chromium/GSAP/FFmpeg, décodage intégral, échantillons audio identiques, modèle Whisper chargé localement et inférence CPU int8, SQLite/API avec refus anonyme et manifeste PWA.

Une absence de wheel n’est pas une preuve de baisse de précision. Si le test ARM échoue, diagnostiquer avant remplacement. Option gratuite à étudier seulement si nécessaire : whisper.cpp avec le même modèle Whisper et alignement de mots, à comparer sur parole réelle ; aucune équivalence de précision n’est promise. Ne pas basculer vers un petit modèle ou une API payante pour masquer un échec.

Même avec un test technique ARM réussi, l’égalité des mots et des timings sur un rush réel entre architectures reste à vérifier. Ne pas annoncer de précision identique avant ce contrôle.

## Commandes sur la VM — UNIQUEMENT APRÈS VALIDATION

Ces commandes ne créent pas la VM. Les exécuter dans le terminal SSH de la nouvelle VM isolée, pas en production. Vérifier `uname -m` = `aarch64`, ressources et coûts avant de continuer.

```sh
sudo apt-get update
sudo apt-get install -y git docker.io docker-compose-v2 python3 sqlite3
sudo systemctl enable --now docker
sudo git clone --single-branch --branch codex/oracle-arm64-free-preparation-20261025 https://github.com/madanesliav04-droid/-ReelScore.git /opt/socialplus
cd /opt/socialplus
sudo docker build -f apps/socialplus/deploy/Dockerfile.oracle-arm64 -t socialplus-oracle:arm64-verified .
sudo docker run --rm --cpus=2 --memory=9g --shm-size=256m socialplus-oracle:arm64-verified node scripts/arm64-runtime-smoke.mjs
```

Le téléchargement public des poids a lieu au build seulement ; le runtime est configuré hors ligne. Ne pas continuer si ce contrôle échoue. Le préparateur rétablit seulement un LF terminal historiquement omis lors d’un transport, si et seulement si cela restitue exactement l’empreinte verrouillée ; aucune modification de logique moteur.

```sh
sudo install -d -m 700 /etc/socialplus /var/lib/socialplus /var/lib/socialplus/backups
sudo install -d -m 700 -o 1000 -g 1000 /var/lib/socialplus/data /var/lib/socialplus/tmp
sudo install -d -m 700 /var/lib/socialplus/caddy-data /var/lib/socialplus/caddy-config
sudo install -m 600 apps/socialplus/deploy/oracle/app.env.example /etc/socialplus/app.env
sudo install -m 600 apps/socialplus/deploy/oracle/https.env.example /etc/socialplus/https.env
sudo chown 1000:1000 /etc/socialplus/app.env
sudo nano /etc/socialplus/app.env
sudo nano /etc/socialplus/https.env
```

Remplacer les deux noms d’hôte, avec **la même** origine HTTPS exacte. Ne pas copier les secrets d’une production existante. Créer un propriétaire de test distinct :

```sh
cd /opt/socialplus/apps/socialplus/deploy/oracle
sudo docker compose run --rm --no-deps -it -v /etc/socialplus/app.env:/app/apps/socialplus/.env.local app node scripts/provision-owner.mjs --init
sudo chmod 600 /etc/socialplus/app.env
sudo docker compose config --quiet
sudo docker compose run --rm --no-deps https caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Le provisionnement demande votre email, votre mot de passe et votre application TOTP dans le terminal privé. Il initialise SQLite sur le volume persistant et enregistre ID/secret de test dans le fichier privé monté. Aucun envoi d’email, paiement ni auth désactivée.

Après dernière validation de l’activation réseau :

```sh
sudo cp /opt/socialplus/apps/socialplus/deploy/oracle/socialplus*.service /etc/systemd/system/
sudo cp /opt/socialplus/apps/socialplus/deploy/oracle/socialplus*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now socialplus.service
sudo systemctl enable --now socialplus-maintenance.timer socialplus-disk-guard.timer
```

Caddy obtient/renouvelle le certificat ACME gratuit sur le domaine approuvé ; DNS et ports doivent fonctionner. Aucun listener applicatif 4318 n’est publié par Compose. Le navigateur reçoit les cookies Secure/HttpOnly et la protection CSRF existants sur cette même origine. Aucun bucket vidéo public.

## Exploitation, suppression temporaire et sauvegardes

- Une seule instance applicative ; aucun scaling ni second worker. Limites conteneur : app 1,8 CPU / 9 Gio, proxy 0,2 CPU / 384 Mio, journaux tournants. Le script Whisper conserve ses paramètres validés ; ses quatre threads sont soumis au plafond de CPU du conteneur.
- Le garde disque arrête le service si moins de 8 Gio restent disponibles. Cela rend l’application indisponible plutôt que de remplir le disque. Corriger le stockage puis redémarrer manuellement ; ce n’est pas une mesure instantanée ni un quota OCI.
- Maintenance chaque jour à 04:00 UTC : arrêt du worker, suppression des seuls répertoires de travail abandonnés > 24 h, sauvegarde SQLite cohérente + médias, conservation de trois archives locales privées, redémarrage. Prévoir une interruption et la reprise éventuelle du rendu interrompu. Ne pas retirer les fichiers source de projets actifs.
- **Limite :** ces sauvegardes locales ne protègent pas contre la perte du volume/compte. Copier régulièrement les archives et les deux fichiers d’environnement par SSH dans votre stockage personnel privé existant ; protéger particulièrement le TOTP. Aucun abonnement de sauvegarde n’est activé. Les cinq sauvegardes de volume OCI incluses peuvent être étudiées séparément après vérification des quotas, jamais lancées automatiquement ici.
- Restauration de test : arrêter le service, conserver les données actuelles, extraire une archive privée vérifiée vers un dossier temporaire, lancer `sqlite3 ... 'PRAGMA integrity_check;'`, replacer `data/`, remettre propriétaire UID/GID 1000, rétablir les secrets correspondants et redémarrer. Tester la restauration avant d’inviter des tiers. Elle n’a pas encore été exécutée sur OCI.
- Pour l’arrêt complet : `sudo systemctl disable --now socialplus-maintenance.timer socialplus-disk-guard.timer socialplus.service` puis `sudo docker compose down` dans le dossier du profil. Ne pas effacer les volumes sans export préalable.

## Recette Safari iPhone — non exécutée avant hébergement

1. PC éteint, ouvrir l’URL HTTPS dédiée sur Safari ; vérifier le certificat, se connecter avec le compte/MFA de test.
2. Importer une vidéo native, préparer analyse/transcription, lire les avertissements. Sélectionner V28 ; pour le rush approuvé, réutiliser exactement ses mots et sa direction liés à son empreinte. Pour un nouveau rush, constater le blocage explicite si aucune direction n’a été préparée.
3. Lancer le moteur réel ; progression existante par étapes (pas une progression par frame). Observer erreurs/quota/réseau sans faux succès.
4. Lire le MP4 avec audio, conserver le format natif, partager/télécharger dans Fichiers, puis rouvrir le projet et son résultat après reconnexion.
5. Avec une autre session de test, vérifier l’interdiction d’accéder aux fichiers de ce projet ; tester déconnexion, arrêt/reprise serveur, suppression et sauvegarde/restauration.
6. Mesurer temps, RAM/CPU/disque sur l’Ampere réelle. Comparer le rendu et les mots à la référence privée ; ne jamais envoyer les médias dans les logs/actions publics.

Aucune URL Oracle n’existe encore. Le test sur iPhone physique et le montage réel hébergé ne peuvent être déclarés réussis avant création autorisée, configuration HTTPS/auth et exécution de cette recette.
