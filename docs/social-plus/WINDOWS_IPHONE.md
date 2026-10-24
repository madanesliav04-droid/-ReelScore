# Social+ sur Windows et iPhone — installation privée

Ce guide lance l’application existante sur **votre PC**, sans Vercel, tunnel, abonnement ou publication Internet. PC et iPhone doivent être sur le **même Wi-Fi de confiance**. Gardez le PC allumé pendant l’essai. Les six adaptations sont des bêtas connectées ; Cinematic affiche « bêta — transcription à vérifier ». Aucune fidélité artistique ou phonétique n’est certifiée par cette installation.

## 1. Installer les outils gratuits une seule fois

Windows 10/11 64 bits. Ouvrez **Terminal → PowerShell** depuis le menu Démarrer. Copiez les commandes suivantes, une ligne à la fois. Acceptez uniquement les installations des éditeurs attendus indiqués par Windows/winget.

```powershell
winget install --id Git.Git --exact
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Python.Python.3.12 --exact
winget install --id Microsoft.VCRedist.2015+.x64 --exact
winget install --id Gyan.FFmpeg --exact
winget install --id FiloSottile.mkcert --exact
```

Edge est normalement déjà installé et suffit pour le moteur Kinetic. Fermez puis rouvrez PowerShell pour actualiser les chemins des outils. Si `winget` manque, installez **Programme d’installation d’application** depuis Microsoft Store. Si `python` ouvre le Store plutôt que Python, désactivez ses alias Microsoft Store dans Paramètres → Applications → Alias d’exécution, puis rouvrez PowerShell.

Vérification :

```powershell
node --version
python --version
ffmpeg -version
mkcert -version
```

Node doit afficher **v24 ou plus récent**. Aucun moyen de paiement n’est demandé. Les téléchargements initiaux nécessitent Internet ; les rendus et analyses restent ensuite locaux.

## 2. Récupérer la branche d’essai

Pour une nouvelle installation, dans PowerShell :

```powershell
Set-Location $HOME
New-Item -ItemType Directory -Force SocialPlus | Out-Null
Set-Location SocialPlus
git clone --branch codex/socialplus-mobile-premium-20261024 https://github.com/madanesliav04-droid/-ReelScore.git
Set-Location .\-ReelScore\apps\socialplus
```

**Si vous avez déjà une installation avec des vidéos**, ne la supprimez pas et ne recopiez pas sa base pendant que le serveur fonctionne. Arrêtez-la avec Ctrl+C, sauvegardez ensemble `.data` et `.env.local`, puis utilisez la nouvelle branche dans ce même dépôt seulement si Git n’annonce aucune modification locale en conflit. Le lanceur conserve le dossier de données et les identifiants existants ; il n’efface et ne migre rien.

### Mettre à jour une installation locale existante

Après arrêt du serveur et sauvegarde privée, depuis le dossier du dépôt existant :

```powershell
git fetch origin
git switch codex/socialplus-mobile-premium-20261024
```

Si Git signale des modifications en conflit, arrêtez-vous : ne forcez pas le changement de branche. Les dossiers privés ignorés par Git sont conservés. Si l’installation HTTPS fonctionnait déjà et que l’IP Wi-Fi n’a pas changé, il suffit ensuite de relancer `DEMARRER-SOCIALPLUS.cmd` et d’actualiser Safari ; les dépendances et certificats de la nouvelle interface n’ont pas changé.

## 3. Préparer le Wi-Fi et lancer l’installation

Dans Windows : **Paramètres → Réseau et Internet → Wi-Fi → propriétés du réseau connecté → Type de profil réseau : Privé**. Faites-le seulement sur votre réseau domestique/de confiance, jamais sur un Wi-Fi public.

Dans le dossier `apps\socialplus`, exécutez **une commande** :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALLER-SOCIALPLUS.ps1
```

`Bypass` s’applique uniquement à ce lancement du script local ; cela ne modifie pas la politique permanente de Windows. Lisez le script avant de l’exécuter.

Le script :

1. Affiche les adresses réseau du PC. Copiez celle de **Wi-Fi**, par exemple `192.168.1.25` (pas celle de VPN, WSL, Docker ou VirtualBox).
2. Installe les dépendances npm verrouillées et un Python isolé dans `.local-windows`. Il télécharge le modèle Whisper small public, environ 500 Mo, **une seule fois**, sans clé API ni facturation. Pour une relance sans téléchargement : ajouter `-SansTelechargementModele` si le modèle est déjà complet.
3. Crée le certificat HTTPS local avec mkcert. Windows peut demander l’autorisation d’installer une autorité locale ; elle ne concerne que votre PC et les appareils où vous choisissez de l’installer.
4. Vérifie FFmpeg, les sous-titres ASS, Python, Chromium/Edge et le modèle local.
5. Crée le propriétaire seulement s’il n’existe pas encore : saisissez votre adresse, ajoutez la clé affichée à une application d’authentification TOTP, saisissez son code puis choisissez un mot de passe d’au moins 12 caractères. **La clé MFA reste dans votre terminal privé : ne partagez pas de capture.** Aucun e-mail n’est envoyé automatiquement.

Les clés de certificat, le modèle et les chemins privés sont exclus de Git. Gardez également `.env.local` et `.data` privés.

## 4. Autoriser uniquement le réseau local dans le pare-feu

Ouvrez une **deuxième fenêtre PowerShell en tant qu’administrateur** (clic droit → Exécuter en tant qu’administrateur), puis placez-vous dans le dossier de l’application :

```powershell
Set-Location "$HOME\SocialPlus\-ReelScore\apps\socialplus"
powershell -NoProfile -ExecutionPolicy Bypass -File .\CONFIGURER-PAREFEU.ps1
```

La règle ne concerne que Node, le port 8443, l’adresse et l’interface choisies, le profil **Privé** et les appareils du sous-réseau local. N’autorisez pas Node sur les réseaux publics. **N’ouvrez aucun port sur votre box/routeur**, ne configurez ni redirection NAT, ni DMZ, ni tunnel. Si le PC dépend d’un administrateur d’entreprise, demandez-lui cette règle locale précise.

## 5. Installer le certificat sur l’iPhone

Le script crée dans **Documents** le fichier **`SocialPlus-certificat-iPhone.cer`**. C’est uniquement le certificat public de confiance.

1. Transférez **ce seul fichier** sur l’iPhone, par exemple avec votre iCloud Drive existant ou une pièce jointe personnelle. Il ne contient ni mot de passe ni vidéo. Ne transférez **jamais** `rootCA-key.pem`, `socialplus-key.pem`, `.env.local` ou le dossier `.local-windows`.
2. Dans Fichiers, touchez le fichier `.cer`. Si iOS propose « Profil téléchargé », ouvrez **Réglages → Général → VPN et gestion de l’appareil** (ou **Profil téléchargé** en haut de Réglages).
3. Ouvrez le profil mkcert de votre PC → **Installer**, saisissez le code de déverrouillage et confirmez. N’installez aucun autre profil provenant d’un tiers.
4. Activez sa confiance dans **Réglages → Général → Informations → Réglages des certificats → Activer la confiance totale** pour cette autorité mkcert.
5. Retournez dans Safari. L’adresse exacte du PC doit s’ouvrir sans avertissement de certificat. **Ne contournez pas un avertissement** : vérifiez la confiance et l’adresse utilisée.

Les intitulés peuvent légèrement varier selon la version iOS. Si Fichiers n’offre pas l’installation, ouvrez la pièce jointe `.cer` directement depuis Mail sur l’iPhone, puis reprenez l’étape 2.

## 6. Démarrer et se connecter

Chaque fois que vous voulez tester, **double-cliquez `DEMARRER-SOCIALPLUS.cmd`** dans `apps\socialplus`. Vous pouvez aussi taper :

```powershell
.\DEMARRER-SOCIALPLUS.cmd
```

Laissez la fenêtre ouverte. Elle affiche votre adresse, par exemple **`https://192.168.1.25:8443`**. Ce n’est qu’un exemple : utilisez l’adresse réellement affichée.

- **PC :** ouvrez cette adresse dans Edge ou Chrome.
- **iPhone :** connecté au même Wi-Fi, ouvrez **la même adresse dans Safari**. `localhost` sur l’iPhone ne désigne pas votre PC.
- Connectez-vous avec votre compte, mot de passe et code MFA. Aucun compte de démonstration ni connexion automatique n’est ajouté.

Pour un membre de test, créez une invitation personnelle dans l’administration. Un membre ne peut pas accéder à l’administration du propriétaire.

## 7. Parcours à tester sur iPhone

Commencez par un rush parlé de 10 à 30 secondes (maximum **60 secondes**, **1080p**, **200 Mo** pour les six adaptations), avec une seule personne et une voix audible. Le format natif et la voix originale sont conservés ; le port H.264 exige des dimensions paires.

1. **Analyse** → choisir la vidéo (enregistrement automatique) → **Analyser mon rush**. Attendez la fin de l’envoi et des mesures, sans verrouiller l’iPhone. Les indices acoustiques, leur formule et les pauses mesurées apparaissent. Hook, sens, CTA et autres critères non mesurés restent **non évaluables**, sauf observations manuelles documentées ; aucun score de viralité n’est inventé.
2. **Monter cette vidéo** : le même projet s’ouvre dans Montage, sans nouvel import.
3. Choisir l’un des **six modèles**, puis **Préparer mon montage**. La transcription CPU peut prendre plusieurs minutes selon le PC. Gardez la page ouverte.
4. Écouter le rush, vérifier la transcription et le placement. Les horaires et animations proposés ne sont pas certifiés. Garder le mode **prévisualisation avec transcription encore à relire** si des mots restent incertains ; ne pas confirmer des mots que vous n’avez pas vérifiés.
5. Vérifier les zones graphiques et cocher la confirmation de placement, puis **Lancer le montage**. Cinematic utilise son planificateur autonome et reste marqué bêta.
6. Après le traitement, toucher lecture puis **Télécharger le MP4**. Sur Safari, confirmer le téléchargement et le retrouver via le bouton Téléchargements ou **Fichiers → Téléchargements**. Ne fermez pas Safari pendant le transfert.
7. Pour un autre modèle, le sélectionner et **vérifier ses nouvelles propositions d’animations** avant de relancer. Le dernier export du projet remplace le précédent : téléchargez chaque résultat avant le suivant. La limite par défaut est de dix traitements par jour ; analyse et transcription initiales comptent aussi, leur relecture en cache ne compte pas. Pour essayer les six modèles sur un seul rush, c’est suffisant si vous réutilisez ce même projet.

Si un traitement échoue, copiez son message exact, le modèle et la durée du rush. Un moteur ou une dépendance manquante doit provoquer une erreur explicite, jamais un faux résultat.

## 8. Arrêter, conserver et dépanner

- **Arrêt :** attendez la fin des rendus, puis Ctrl+C dans la fenêtre Social+. L’adresse ne répond plus. Aucun processus de tunnel n’existe.
- **Sauvegarde :** serveur arrêté, copiez `.data`, `.env.local` et `.local-windows` dans un stockage privé. Si `SOCIALPLUS_DATA_DIR` est personnalisé, sauvegardez ce dossier à la place de `.data`. Une clé de certificat sauvegardée reste sensible.
- **Wi-Fi/IP modifié :** relancez l’installateur avec la nouvelle IP, puis le script pare-feu administrateur. La même autorité mkcert sur ce PC reste valable sur l’iPhone ; le certificat serveur doit inclure la nouvelle IP. Ne supprimez pas la base ni le propriétaire.
- **iPhone ne joint pas le PC :** vérifier même Wi-Fi, fenêtre serveur ouverte, IP actuelle, réseau Windows Privé et règle pare-feu. Un réseau « invités » ou l’isolation des clients du routeur empêche les appareils de se joindre. La veille du PC interrompt aussi l’accès. Ne désactivez pas globalement le pare-feu.
- **Erreur certificat :** vérifier le certificat public du bon PC, son installation et la confiance totale, puis l’adresse exacte ; ne pas utiliser `http://`.
- **Après les tests :** pour retirer la règle, PowerShell administrateur : `Remove-NetFirewallRule -Name SocialPlus-local-HTTPS`. Sur iPhone, désactivez la confiance puis supprimez le profil mkcert dans VPN et gestion de l’appareil si vous n’en avez plus besoin. Le certificat local n’autorise aucun accès Internet.

## Ce qui a été vérifié avant livraison

Les deux parcours ont déjà été exécutés sur un vrai extrait parlé dans Chromium en émulation iPhone : analyse → même projet → Leila → MP4 lu et téléchargé, format 910×512 et piste audio stéréo uniques conservés. La reprise du rendu après navigation est également testée. Cela **ne remplace pas** un essai de votre installation Windows ni de Safari sur votre iPhone physique. Le nouveau transport HTTPS possède ses tests de restriction réseau ; les résultats complémentaires sont consignés dans le rapport livré avec cette branche.

## Nouvelle navigation mobile

Les quatre onglets sont **Accueil**, **Montage**, **Analyse** et **Projets**. L’import dans Montage ou Analyse crée et enregistre automatiquement un projet ; il n’est plus nécessaire de remplir un formulaire de sauvegarde avant de commencer. Renommer reste possible dans « Nom du projet ». Dans Analyse, le choix d’un rush enregistré évite un nouvel import. La bibliothèque Projets permet aussi de lire, télécharger et supprimer un projet ; les options de partage natif dépendent du navigateur. Les mots et points d’écoute sont accessibles dans « Paroles et synchronisation », avec le JSON réservé aux outils avancés.
