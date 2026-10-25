# Test Social+ sur iPhone avec votre PC Windows

Ce mode sert l’interface actuelle et le backend sur votre PC, par une URL HTTPS Cloudflare temporaire. Aucun Railway, déploiement Vercel, domaine acheté, abonnement ou compte Cloudflare. Les moteurs verrouillés ne sont pas modifiés. Vos comptes et projets restent dans `.data`, vos paramètres dans `.env.local`. Ne supprimez ni ne partagez ces dossiers.

L’URL donne accès à la page de connexion, **pas à vos projets**. Le propriétaire se connecte avec son mot de passe et son code MFA. Les vidéos et API privées exigent cette session. Cloudflare transporte les requêtes entre Safari et le PC ; ce n’est pas un accès LAN uniquement. Gardez le lien pour les testeurs autorisés.

## 1. Préparer le PC

Arrêtez tout ancien serveur Social+ avec **Ctrl+C**. Sauvegardez `.data` et `.env.local` ensemble pendant son arrêt. Ne désinstallez pas l’application et ne créez pas un autre compte propriétaire si le vôtre existe.

Dans PowerShell **à la racine de votre dépôt existant** :

```powershell
git fetch origin
git switch codex/socialplus-windows-quick-tunnel-20261025
cd apps\socialplus
```

Si Git indique des modifications locales en conflit, ne forcez pas. Les dossiers privés ignorés par Git restent conservés lors d’un changement de branche normal. Les PR #55 et #57 ne sont pas modifiées par cette branche.

Prérequis : Git, Node.js **24 minimum**, Python 3.12, FFmpeg/FFprobe et Chrome ou Edge. Si un de ces outils manque, les commandes gratuites correspondantes sont :

```powershell
winget install --exact --id Git.Git
winget install --exact --id OpenJS.NodeJS.LTS
winget install --exact --id Python.Python.3.12
winget install --exact --id Gyan.FFmpeg
```

N’exécutez que celles nécessaires. Installez également le connecteur du tunnel :

```powershell
winget install --exact --id Cloudflare.cloudflared
```

Après une nouvelle installation, fermez et rouvrez PowerShell dans `apps\socialplus` pour actualiser le PATH. Aucun `cloudflared login`, token ou carte bancaire n’est requis.

## 2. Installer ou reprendre les dépendances

Depuis `apps\socialplus` :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALLER-SOCIALPLUS.ps1 -PourTunnel
```

Ce paramètre saute toute la configuration Wi-Fi/mkcert. Aucun certificat n’est à installer sur l’iPhone et aucun port entrant n’est à ouvrir sur le routeur ou le pare-feu. Les connexions sortantes cloudflared doivent rester autorisées.

L’installation réutilise l’environnement Python privé, prépare Whisper local (téléchargement gratuit d’environ 500 Mo), vérifie FFmpeg/Chrome et conserve votre compte existant. Si vous n’avez pas encore de compte propriétaire, choisissez son mot de passe et configurez le MFA dans votre terminal privé. **Ne nous envoyez ni le QR/lien MFA, ni sa clé, ni votre mot de passe.**

La famille DejaVu Sans Condensed utilisée par la composition historique doit être disponible dans Windows. Si elle manque, le script installe cette dépendance gratuite pour votre compte à partir de l’archive officielle DejaVu 2.37 dont le SHA-256 est contrôlé. Aucun moteur n’est changé. Une première validation visuelle sous Windows reste nécessaire ; les rasters et la police Arial peuvent différer de Linux.

Si Whisper est déjà installé et complet, vous pouvez éviter sa vérification de téléchargement :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALLER-SOCIALPLUS.ps1 -PourTunnel -SansTelechargementModele
```

Le mode tunnel écrit `.local-windows\runtime-tunnel.json` ; il ne remplace pas une configuration HTTPS LAN existante.

## 3. Obtenir votre lien réel

```powershell
.\DEMARRER-TEST-IPHONE.cmd
```

Le lanceur écoute **seulement sur 127.0.0.1**, démarre Cloudflare Quick Tunnel via HTTP/2 et utilise une configuration temporaire vide, sans toucher à vos autres tunnels. Il récupère l’URL attribuée, exige une connexion Cloudflare enregistrée, configure l’origine exacte de Social+ et les cookies `Secure; HttpOnly; SameSite=Strict`.

Il vérifie ensuite depuis le PC que `/healthz` répond en HTTPS et que `/api/projects` répond **401 sans connexion**. Seulement après ces contrôles, il affiche :

```text
Votre lien HTTPS : [URL attribuée par Cloudflare]
```

**Cette URL ne peut pas être connue avant le lancement sur votre PC.** Elle est également disponible dans `.local-windows\last-tunnel-url.txt`. Copiez uniquement ce lien dans Safari. L’interface et l’API partagent cette même origine ; aucun changement de l’aperçu Vercel n’est nécessaire.

Gardez le PC allumé, connecté et la fenêtre ouverte. Désactivez temporairement sa mise en veille pendant l’essai, puis rétablissez votre réglage habituel. Si une boîte Windows demande l’accès réseau à cloudflared, autorisez sa connexion sortante ; aucune règle de port entrant Social+ n’est nécessaire.

## 4. Recette dans Safari sur l’iPhone

Pour la première recette, utilisez le **rush original vertical `SocialPlus_rush_vertical_compresse.mov`**, celui qui possède la direction validée. Placez le fichier original dans Fichiers, sans montage ni réencodage. Le master est une référence : ne l’importez pas à la place du rush.

1. Ouvrez le lien HTTPS réellement affiché et connectez-vous avec votre compte Social+ et le MFA propriétaire.
2. Ouvrez Montage, importez le rush depuis **Choisir un fichier / Fichiers**, puis choisissez **Social Kinetic**.
3. Lancez **Préparer mon montage**. Le PC effectue l’analyse et la transcription locales. Écoutez les mots signalés ; une alerte ASR n’est pas une validation phonétique.
4. Vérifiez les zones, cochez leur confirmation et laissez le mode de prévisualisation si les paroles ne sont pas toutes confirmées. Lancez le montage.
5. Observez la progression **par étapes réelles**. Attendez l’apparition de la vidéo complète, puis lancez sa lecture.
6. Touchez **Télécharger le MP4**. Selon la version de Safari, confirmez le téléchargement ou utilisez la feuille de partage puis **Enregistrer dans Fichiers**. Vérifiez le fichier téléchargé dans Fichiers.
7. Revenez dans Projets, ouvrez ce projet et vérifiez lecture/téléchargement. Pour vérifier la persistance : arrêtez le tunnel sur le PC après la fin du rendu, relancez-le, connectez-vous à la **nouvelle URL**, puis retrouvez le projet.

Une autre vidéo, ou une copie réencodée dont la transcription change, ne récupère pas les indices de ce rush. Elle nécessite sa propre direction contextuelle dans Animations avancées. Le raccordement ne génère pas automatiquement une direction éditoriale V28 pour n’importe quelle vidéo et ne lance pas un ancien preset à sa place.

Pour le retour de recette, envoyez uniquement l’URL affichée et indiquez quelles étapes ci-dessus passent/échouent, le modèle d’iPhone/iOS et le message d’erreur éventuel. Pas d’identifiants, de code MFA, de fichier `.env.local` ou de journal complet.

## 5. Arrêter et comprendre les limites

**Ctrl+C** dans la fenêtre du lanceur ferme le tunnel et le serveur. Les fichiers/projets restent sur le PC. Une nouvelle exécution crée une nouvelle URL et exige une nouvelle connexion dans Safari. Fermer Safari seul n’arrête pas le tunnel.

- L’usage Quick Tunnel ne nécessite pas d’offre payante ; l’électricité et la connexion Internet restent celles du PC. Utilisez le Wi-Fi pour éviter d’éventuels frais de données mobiles.
- Pour cet essai, choisissez un fichier de **moins de 90 Mo** et moins de 60 secondes. Le lanceur refuse les imports déclarés au-delà de cette limite, plus prudente que les limites habituelles du proxy Cloudflare.
- Quick Tunnel n’offre pas de garantie de disponibilité et limite les requêtes simultanées à 200. Social+ utilise un suivi par requêtes périodiques, pas SSE.
- Un calcul de transcription très lent peut dépasser le délai du proxy. Gardez la fenêtre ouverte, attendez puis rouvrez le projet : une transcription déjà terminée est conservée. Ne lancez pas plusieurs traitements simultanément.
- Si Cloudflare ne se connecte pas, vérifiez `cloudflared --version`, le DNS et la sortie **TCP 7844**. Le lanceur utilise HTTP/2, sans QUIC/UDP. Si ce réseau bloque Cloudflare, le tunnel ne peut pas être garanti : aucun autre hébergement n’est activé automatiquement.
- Le journal local `.local-windows\cloudflared-last.log` reste privé. Le lanceur n’affiche pas les clés ou paramètres d’authentification.

Documentation Cloudflare : https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

## État des preuves

Cinq nouveaux tests du transport passent : arguments sans compte, lecture des messages de démarrage, refus des mauvaises connexions/volumes, authentification réelle/MFA/cookies/CSRF derrière la passerelle et contrôle externe avant affichage du lien. La syntaxe des deux scripts PowerShell a été analysée. L’intégrité de la V28 verrouillée est vérifiée séparément.

**Non exécuté ici : installation Windows native, connexion Cloudflare depuis votre PC et Safari sur votre iPhone physique.** Aucun lien public de test n’est inventé ou activé depuis le workspace. Les 15 tests du parcours précédent ne sont pas relancés.
