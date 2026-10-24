# Installation locale Windows / iPhone

Aucun moteur reconstruit, aucun déploiement, aucune modification de la PR #53. Branche isolée `codex/socialplus-windows-iphone-20261024`.

## Fichiers livrés

- `apps/socialplus/INSTALLER-SOCIALPLUS.ps1` : installation locale, Python isolé, modèle ASR public, certificat local, préflight, propriétaire existant conservé ou provisionnement MFA standard.
- `apps/socialplus/CONFIGURER-PAREFEU.ps1` : règle Windows privée limitée à l’interface et au sous-réseau local.
- `apps/socialplus/DEMARRER-SOCIALPLUS.cmd` : lancement par double-clic.
- `apps/socialplus/scripts/windows-local.mjs` : transport HTTPS autour du serveur existant, IP RFC1918 assignée obligatoire, port 8443, contrôle de l’adresse hôte et de la provenance réseau ; aucune désactivation d’authentification.
- `apps/socialplus/scripts/windows-local.test.mjs` : garde-fous réseau.
- `apps/socialplus/scripts/download-local-model.py` : téléchargement explicite unique pendant l’installation, pas pendant les rendus.
- `.gitignore`, README et guides Windows actualisés.

## Exécution réelle

Essai sous Linux sur l’interface privée de l’environnement, avec certificat TLS vérifié par le client, sans désactiver sa validation. Base de test isolée et compte propriétaire avec MFA. Aucun fichier ou secret utilisateur publié.

Réussi : refus anonyme, connexion MFA, cookie Secure, refus d’origine étrangère, import du vrai extrait parlé déjà disponible, analyse FFmpeg stable et mise en cache, validation des plans des six modèles, rendu Leila réel, téléchargement et décodage complet, requête HTTP Range 206 de 1024 octets. MP4 H.264 910×512, une piste AAC stéréo, 733498 octets. Transcription déjà calculée du même fichier réutilisée : aucune nouvelle inférence ASR inutile. Ces contrôles ne certifient pas la fidélité des six modèles et ne constituent pas six nouveaux rendus.

Deux tests Node ciblés réussis : restriction réseau HTTPS locale et intégration sécurité HTTP existante. Syntaxe des deux scripts `.ps1` analysée sans erreur avec PowerShell 7 sous Linux. Script Python compilé sans erreur ; téléchargement non répété puisque le modèle est déjà disponible.

## À vérifier sur le matériel utilisateur

L’installation native Windows (winget, mkcert, ACL, pare-feu) et Safari iPhone physique n’ont pas été exécutés dans cet environnement Linux. L’installateur évite les commandes Python/Node inline avec guillemets embarqués pour rester compatible avec Windows PowerShell 5.1. Le guide décrit les prérequis, le certificat iOS, la confiance totale, l’accès Wi-Fi, le parcours et l’arrêt.

L’adresse exacte dépend de l’IP du PC. Aucun lien HTTPS de cet environnement distant ne peut remplacer cette adresse locale. Une IP modifiée exige une régénération du certificat serveur et de la règle pare-feu. Les données persistent sur le disque du PC ; le stockage des rendus reste privé et authentifié. Avant l’arrêt et la sauvegarde, attendre la fin des rendus. Aucun port de box ne doit être ouvert.
