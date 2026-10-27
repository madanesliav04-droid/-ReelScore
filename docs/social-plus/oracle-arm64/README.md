# Oracle Always Free — vérification Alex V16, 27 octobre 2026

Ce dossier prépare une décision, sans déploiement, création de compte, changement
d'architecture ou modification des six moteurs. Base examinée : commit local
`b729ef755668e44fee424ae85d5634090f00aed0`, objet GitHub correspondant
`c492254d3adae25f56f253b0297f4094d74d1cd4`.

## Résultat effectif

**Compatibilité des composants Alex démontrée sous émulation ARM64 ; déploiement
Oracle complet et dimensionnement natif non validés.**

Une première image ARM64 a été construite et importée dans Docker. La version
finale avec correction du propriétaire des fichiers a ensuite exécuté avec
succès tous ses tests de construction : imports natifs, import Alex/Remotion
sous `node`, 13 tests Python, MP4 synthétique H.264/AAC encodé/décodé, inférence
Whisper small INT8 sur silence synthétique. Cependant son **import final dans
Docker a échoué par manque de disque** : `no space left on device`.
Il n'existe donc pas d'artefact final corrigé disponible à livrer. Aucune
nouvelle construction identique n'est relancée après cet échec de stockage.

Les tentatives initiales ont rencontré `exec format error` sans émulation,
puis la configuration réseau/CA du builder a été adaptée. Le builder QEMU a
ensuite bien exécuté les binaires ARM64. Les étapes finales et leurs statuts
exacts sont consignés dans `results.json` et `test-evidence.log`.

Le workspace dispose d'un disque de 32 Go partagé avec les travaux précédents ;
les snapshots natifs et l'import Docker réclament plusieurs copies temporaires.
Cet échec n'établit pas une incompatibilité ARM64 du moteur, mais empêche de
déclarer l'image finale livrée ou son lancement final validé. Ni les médias
personnels, ni les moteurs, ni la production n'ont été modifiés.

Il reste à terminer la construction avec davantage de disque, puis exécuter le
benchmark privé sur A1. **Les besoins réels CPU/RAM/stockage temporaire et le temps
de rendu A1 restent inconnus.** Le budget de 2 OCPU/12 Go est un quota disponible,
pas une preuve de performance. Aucun export Alex complet depuis un rush parlé
n'a été exécuté en ARM64 dans cette session.

## Chemin réel et compatibilité

`apps/worker/src/index.js` appelle `renderAlexV16` dans
`src/alex-v16-pipeline.js` : mesures FFmpeg, transcription locale, plan existant,
normalisation/cuts FFmpeg, composition Pillow, encodage H.264/AAC, contrôle MP4.
Le chemin Alex ne fait pas appel au rendu Chromium. Son import `render.js`
charge néanmoins Remotion ; une installation ARM64 doit donc aussi permettre
ces imports. Ne pas confondre l'absence d'appel navigateur avec une dépendance
JavaScript absente.

* Node 24 Bookworm fournit une image ARM64 ; la base a été téléchargée.
* FFmpeg Debian Bookworm est disponible en ARM64, sans GPU nécessaire.
* `Pillow==12.3.0`, `numpy==2.3.5`, `faster-whisper==1.2.1` et **toutes** leurs
  dépendances ont été téléchargés sous forme de wheels CPython 3.11 ARM64.
  Liste, tailles et SHA256 dans `wheels.json`. Ce téléchargement n'est pas un
  test d'import ou d'inférence. Il faut autoriser les tags manylinux_2_28 et
  manylinux_2_27, pas seulement manylinux2014.
  `native-libraries.json` vérifie aussi les en-têtes ELF AArch64 des bibliothèques
  contenues dans ces wheels ; cela ne prouve pas leur chargement dynamique.
* CTranslate2 annonce le support CPU AArch64 ; conserver le même modèle Whisper
  small, le même hash, INT8, beam5 et les contrôles d'incertitude. Aucune nécessité
  démontrée de remplacer l'ASR. Une architecture différente peut néanmoins
  produire des différences numériques : refaire la comparaison de transcription.
* Remotion installé est 4.0.530. Son code inclut les chemins de téléchargement
  Chromium ARM64 et `@remotion/compositor-linux-arm64-gnu`. Le support documentaire
  ne remplace pas un test de lancement et de rendu de cette version.
* Les polices Alex sont incluses et hashées dans `reconstruction/alex-v16/fonts`.
  Aucun remplacement de police n'a été effectué.

## Mesures : ce qui doit réellement être mesuré

Le précédent parcours local x86 a produit un MP4 vertical de 27,166667 s en
36,010 s (preuve privée `alex-v16-validation/isolated/e2e-result.json`). Ce n'est
**pas** une mesure Oracle A1, ni une preuve de mémoire maximale.

La configuration de départ à vérifier est 2 OCPU / 12 Go total, un seul worker,
un seul rendu, conteneur worker plafonné à 8 Go sans swap. Réserver le reste
à l'OS et à Next. Les quatre threads ASR existants restent inchangés, le quota
cgroup limite le CPU à deux ; il ne garantit pas un temps de rendu donné.

Pour mesurer sur une machine ARM64 native, avec l'image construite et le rush
privé déjà disponible (aucune clé ni connexion réseau dans le conteneur) :

```bash
docker build --platform linux/arm64 \
  -f deploy/oracle-arm64-validation/Dockerfile \
  -t socialplus-alex-arm64-check .
bash deploy/oracle-arm64-validation/benchmark.sh \
  socialplus-alex-arm64-check /chemin/prive/rush.mov /chemin/prive/resultat-neuf
```

Le script refuse un hôte x86 et un dossier de sortie existant. Il lance le vrai
pipeline, conserve le MP4 et les éléments de revue privés, enregistre temps réel,
CPU cgroup et mémoire maximale lorsque cgroup v2 les expose. Le MP4 reste un
export à relire si l'ASR l'exige ; aucune certification des paroles n'est inventée.
Comparer aussi `du -sh` de l'espace de travail avant/après et la taille de
l'image. Une vidéo 1080p/4K ne peut pas être dimensionnée à partir d'un test 512p.

Les mesures QEMU éventuelles sont des tests de compatibilité, pas un benchmark
Oracle. Aucun achat de machine ou lancement de workflow distant n'est autorisé.
Le Dockerfile est une image de contrôle Alex, pas une image contenant les six
navigateurs/moteurs prêts à servir. Il vérifie les imports natifs, les 13 tests
graphiques, un encodage/décodage H.264/AAC synthétique et une inférence Whisper
sur silence synthétique. Cette dernière ne valide aucune parole ni sa fidélité.
Chromium/Playwright ne sont pas installés : leur lancement n'est pas validé ici
et n'est pas nécessaire au chemin Alex examiné. Toute activation d'un autre
chemin navigateur exige sa propre vérification et ses dépendances système.

Un défaut de packaging a été corrigé dans le Dockerfile de préparation existant :
les copies applicatives sont désormais propriétaires `node`, pour supporter un
checkout en mode 0600 sans rendre l'application illisible après `USER node`.
Le Dockerfile de validation vérifie aussi l'import sous cet utilisateur.
L'installation npm a également annoncé 10 alertes de sévérité haute. Leur
exploitabilité n'a pas été auditée ici ; aucune mise à jour automatique des
dépendances des moteurs n'a été effectuée. Cette image n'est donc pas une
validation de sécurité pour une ouverture publique.

## Conditions gratuites vérifiées dans les sources officielles

| Service | Gratuité et limites | Conséquence Social+ |
|---|---|---|
| Oracle A1 Always Free | 1 500 OCPU-h et 9 000 Go-h/mois, équivalent 2 OCPU/12 Go, région principale ; 200 Go de volumes partagés avec les disques de démarrage | Possible sans crédit d'essai, capacité disponible non garantie |
| Oracle compte | Carte bancaire admissible et identité vérifiées ; autorisation bancaire temporaire possible ; pas de débit sans passage volontaire au payant | Le propriétaire doit créer et vérifier son compte ; ne jamais activer Pay As You Go |
| Oracle disponibilité | Une instance peu utilisée peut être récupérée ; compte inactif peut être suspendu | Always Free n'est pas une garantie de disponibilité commerciale |
| Vercel Hobby | Usage personnel/non commercial uniquement | Inadapté comme base durable d'un produit destiné à générer des revenus, même avant les premières ventes |
| Supabase Free | 2 projets actifs, DB 500 Mo/projet, stockage 1 Go, egress 5 Go (+ cache distinct), pause après une semaine d'inactivité, pas de sauvegarde automatique incluse | Compatible petite bêta plafonnée ; usage réel du compte à vérifier, pas d'illimité |
| Supabase fichiers | 50 Mo par objet en Free | Le code découpe les imports >40 MiB ; vérifier aussi l'export final, qui n'est pas découpé et peut dépasser 50 Mo |
| R2 Standard | 10 Go-mois, 1 million opérations A, 10 millions B, sortie gratuite ; dépassement facturé | Nécessite une souscription et un moyen de paiement dans le parcours d'activation ; pas une garantie de facture nulle |
| Remotion | Licence gratuite pour individus/structures admissibles jusqu'à 3 personnes, conditions applicables | Vérifier l'éligibilité si l'équipe grandit ; pas de souscription déclenchée ici |

Oracle permet également 20 Go d'Object Storage cumulés en compte Always Free
seul et 50 000 requêtes/mois. Pendant l'essai ou sur compte payant, les catégories
de stockage gratuites sont différentes : ne pas configurer aveuglément 20 Go
Standard pendant l'essai. Ne pas compter les crédits temporaires dans le budget.
Les cinq sauvegardes de volumes gratuites sont un plafond global, pas cinq
sauvegardes par disque. Le trafic sortant Always Free annoncé est de 10 To/mois.

Sources consultées le 27/10/2026 :

* https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
* https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
* https://www.oracle.com/cloud/free/faq/
* https://vercel.com/legal/terms
* https://supabase.com/pricing
* https://supabase.com/docs/guides/platform/billing-on-supabase
* https://supabase.com/docs/guides/storage/uploads/file-limits
* https://developers.cloudflare.com/r2/pricing/
* https://developers.cloudflare.com/r2/get-started/
* https://opennmt.net/CTranslate2/hardware_support.html
* https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell
* https://www.remotion.dev/docs/license/pricing

## Architecture proposée, non appliquée

1. Même code Next, API de contrôle et authentification existantes ; exécuter
   Next sur Oracle au lieu de rendre Vercel indispensable. HTTPS via reverse
   proxy et nom DNS contrôlé par le propriétaire (disponibilité du nom à vérifier).
2. Worker Alex existant en conteneur ARM64 séparé, sans port public, sans Gemini,
   une réplique. File de jobs PostgreSQL/Supabase conservée, pas de nouvelle file.
3. Projet Supabase Free isolé : Auth, tables/RLS, fonctions et Storage privés
   existants. Ce chemin évite une réécriture de l'authentification et des uploads.
   Les quotas ne constituent pas une validation de sa configuration actuelle.
   La délivrabilité des invitations n'est pas acquise avec le SMTP par défaut :
   commencer par des comptes de test confirmés provisionnés par l'administrateur,
   pas par une promesse d'envoi illimité d'e-mails.
4. Pas de R2 activé pour cette première étape stricte 0 €. Le chemin R2 existe
   déjà dans le worker et l'API ; l'activer ultérieurement serait une configuration
   et des tests de stockage, sans modifier les règles Alex. Passer au stockage
   disque/OCI exige un adaptateur d'upload/download et de signature absent du
   parcours Supabase actuel : ne pas prétendre qu'un changement d'URL suffit.
5. Images versionnées, modèle ASR hashé, fichiers de configuration externes,
   secrets hors Git, sauvegarde quotidienne chiffrée de la DB et des métadonnées,
   copie hors VM et test de restauration. `pg_dump` ne sauvegarde ni les objets
   Storage ni toute la configuration/les clés Supabase. Prévoir leur inventaire
   et copie séparée, ainsi que la conservation sûre des clés nécessaires.
6. Stockage local plafonné, nettoyage des travaux échoués, suppression des médias
   expirés pilotée par métadonnées. **La rétention distante automatique annoncée
   de 24 h n'est pas encore implémentée** ; c'est un préalable à une bêta durable.
7. systemd/Docker restart, surveillance disque/RAM/file, arrêt des admissions
   avant saturation et sauvegarde avant upgrade. Aucun conteneur privilégié
   en production. Ports publics 443 seulement, SSH restreint ; IPv4/egress et
   ressources exactes doivent être vérifiés dans le devis console avant création.

La configuration initiale recommandée de disque est 100 Go, incluse dans le
plafond global de 200 Go **si aucune autre ressource ne l'utilise**. Réserver
l'OS/images/modèles, plafonner les vidéos temporaires séparément ; ce sont des
budgets proposés, pas des mesures acquises. Les sauvegardes ne doivent pas remplir
le même disque ni devenir la seule copie lors d'une récupération de VM.

Une migration future consiste à déplacer les mêmes conteneurs et les données,
puis changer les endpoints/secrets. Le moteur reste identique. Un changement de
fournisseur Auth/DB/Storage nécessiterait cependant des adaptations explicites :
la portabilité Docker n'élimine pas le couplage actuel à Supabase.

## Conditions avant décision de déploiement

* Image ARM64 construite, imports natifs et MP4 effectivement exécutés.
* Build ARM64 du frontend Next et de son SWC, reverse proxy/HTTPS et démarrage
  de l'ensemble : non exécutés dans cette vérification du worker Alex.
* Mesures sur A1 native et rush représentatif, y compris sortie >50 Mo/1080p.
* Compte Oracle éligible, capacité A1 et ressources marquées Always Free vérifiées.
* Quotas Supabase et compte réellement Free vérifiés, accès privé, rétention et
  restauration testées. Aucune donnée du projet CRM existant réutilisée.
* Authentification complète, queue, téléchargement signé et Safari physique
  testés dans cet environnement. Les anciens tests locaux ne suffisent pas.

Aucune promesse de « gratuit pour toujours » : quotas, conditions de service,
capacité et licences peuvent évoluer. Sans passage volontaire au payant, préférer
un refus de nouveaux jobs à une activation automatique de ressources facturées.
Le plafond technique doit compter aussi le trafic : à titre d'exemple, un rush
de 100 Mo téléchargé par le worker et un export de 10 Mo visionné puis téléchargé
consomment déjà environ 120 Mo de sortie Storage, hors reprises et autres accès.
Les 5 Go ne permettent donc pas un nombre illimité de rendus. Le contrôle global
du trafic mensuel et de la rétention reste à intégrer/tester avant ouverture
durable ; les limites d'une seule requête ne suffisent pas.
