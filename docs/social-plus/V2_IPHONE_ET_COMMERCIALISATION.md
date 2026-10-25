# V2 — recette iPhone et ouverture commerciale

## Tester sans outil de développement sur le téléphone

Le chemin disponible est **HTTPS privé sur le même Wi-Fi que le PC Windows**, avec le guide [WINDOWS_IPHONE.md](WINDOWS_IPHONE.md). Aucun compte développeur Apple, câble de débogage, application Xcode ni service payant n’est nécessaire sur l’iPhone.

Pour une installation déjà opérationnelle : arrêter Social+, sauvegarder ses données privées, puis dans le dépôt du PC :

```powershell
git fetch origin
git switch codex/socialplus-mobile-premium-20261024
git pull --ff-only
```

Si Git annonce un conflit, ne pas forcer ni supprimer les données. Relancer `apps\socialplus\DEMARRER-SOCIALPLUS.cmd`. Ouvrir **l’adresse HTTPS affichée par ce PC** dans Safari. Les certificats et les dépendances n’ont pas changé si l’IP Wi-Fi est la même. Les nouvelles tables SQLite sont créées sans supprimer les projets existants. Une deuxième instance utilisant le même dossier est refusée. Ne jamais ouvrir un port sur la box.

### Recette à réaliser sur l’iPhone physique

1. Se connecter avec son mot de passe et son code MFA. Vérifier qu’un autre compte membre n’accède pas à l’administration.
2. Importer un rush parlé horizontal, puis un autre **vertical natif**. Vérifier rotation, format, durée et voix. Un recadrage artificiel du premier ne remplace pas le second.
3. Analyser le rush. Distinguer mesures acoustiques, indices textuels provisoires et critères non évaluables. Ouvrir les diagnostics horodatés et écouter la preuve.
4. Choisir une pause après écoute, passer au montage et vérifier que le même rush et la sélection sont conservés sans nouvel import.
5. Choisir un modèle, préparer, relire les paroles. Une zone graphique proposée ne prouve pas l’absence de visage ou de main : vérifier les gestes dans toute la vidéo. Les scènes plein écran sont explicitement signalées.
6. Lancer un rendu bêta. Aller dans Projets puis revenir. Couper brièvement le Wi-Fi et vérifier la récupération du statut sans lancer un deuxième traitement.
7. Lire le MP4, avancer/reculer, changer l’orientation du téléphone. Fermer la prévisualisation : son audio doit s’arrêter. Télécharger et ouvrir le fichier depuis Fichiers.
8. Tester Partager : le premier bouton prépare le fichier privé, le second ouvre le partage OS dans un geste utilisateur. Si Safari ne prend pas en charge le partage de fichier, utiliser Téléchargement puis Fichiers. Aucun lien vidéo public n’est créé.
9. Vérifier navigation à une main, clavier ouvert, texte agrandi, VoiceOver, zones haute/basse et éventuelle Dynamic Island. L’émulation 402×874 n’a pas validé ces comportements matériels.
10. Signaler les résultats par le formulaire privé « Donner mon avis » : modèle, durée, orientation, version iOS, étape et message exact. Ne pas joindre de clé MFA, certificat privé ou mot de passe.

Les scripts navigateur exécutés dans le workspace ne sont pas Safari matériel. Aucun résultat humain n’est coché automatiquement. L’URL du PC ne fonctionne que sur le réseau local ; le workspace distant ne peut pas fabriquer cette adresse pour un iPhone distant.

## État commercial vérifiable

| Élément | État |
|---|---|
| Connexion, MFA propriétaire, isolation membre, révocation | Tests existants et ciblés réussis |
| Administration privée, invitations 7/30 jours/permanentes | Opérationnelles ; ce ne sont pas des codes promotionnels payants |
| Rendus | MP4 réels ; adaptations bêta, qualité artistique/phonétique non certifiée |
| Analyse | Acoustique mesurée et repères textuels locaux ; compréhension du sens/rétention/originalité non certifiées |
| Abonnements, checkout, accès payants, coupons commerciaux | Non implémentés, aucun paiement activé |
| FAQ, support et avis privés | Conservés et testés ; pas de publication de témoignage sans consentement |
| Export/suppression des données | Opérationnels ; échec physique de nettoyage signalé et suivi |
| Mentions/CGU/confidentialité | Brouillons tant que l’identité réelle et la revue propriétaire ne sont pas complétées |
| Sauvegarde/restauration et exploitation publique | Recette opérationnelle à terminer ; l’instance locale n’est pas un hébergement commercial |
| App Store | Plan Capacitor documenté, aucune migration/inscription/paiement engagé |

### Informations et validations requises du propriétaire

- Écoute des **19 extraits existants** et validation des mots et frontières des quatre groupes fusionnés. La session ne permet pas une écoute perceptive certifiée ; aucune nouvelle hypothèse ASR n’est déclarée vraie.
- Rush parlé vertical natif et retour Safari physique. Aucun tel nouveau rush n’a été identifié dans les fichiers disponibles.
- Identité de l’éditeur, adresse et contact légaux, hébergement effectif, bases juridiques, conservation, revue des textes et droits d’utilisation des ressources/références pour l’usage commercial. Ces informations ne sont pas inventées.
- Architecture d’hébergement et budget **avant** tout abonnement, service facturé, paiement ou publication. Les invitations gratuites actuelles ne constituent pas un système d’abonnement.

### Coûts réellement connus

`artifacts/v2/COSTS.json` contient les temps mesurés et tailles d’exports. Les appels de cette implémentation à des services externes payants sont **zéro**. Ce n’est pas un coût total de zéro euro : le CPU, le disque, l’électricité, l’amortissement et l’hébergement n’ont pas de prix réel fourni/mesuré ici.

Les temps du test incluent rendu et contrôles ; ce ne sont pas des secondes CPU facturables. L’administration compte séparément le temps local de traitement enregistré et les reprises. Un seul worker local fonctionne à la fois ; les autres nouvelles demandes simultanées sont refusées explicitement. Une reprise automatique réencode depuis le début et ne consomme pas une nouvelle unité du quota. Les nouveaux paramètres sont conservés pour la reprise puis purgés du descripteur terminal.

La limite logique est 1 Go par membre, 200 Mo par import et dix traitements initiaux/jour, analyses et transcription comprises. Les erreurs de nettoyage peuvent laisser des fichiers physiques en attente : elles nécessitent une intervention sur la machine, pas un faux statut « suppression terminée ». Avant tarification, mesurer sur l’hébergement choisi la consommation CPU/mémoire, le stockage effectif, la concurrence et la rétention, puis calculer les coûts par membre à partir de ses prix réels.

Aucun nouveau modèle IA de compréhension, moteur vision, service externe ou clé API n’a été intégré. Leurs coûts et droits devront être vérifiés sur les offres effectivement retenues avant une intégration ; aucun tarif hypothétique n’est présenté comme vérifié.

## Verdict

**Non commercialisable actuellement.** La V2 améliore la fiabilité et la valeur informative de l’analyse, sans effacer les limites de transcription, fidélité artistique, Safari matériel, conformité et exploitation. Le score de validation 79/100 n’est pas une autorisation de commercialiser ni une certification de sécurité de production.
