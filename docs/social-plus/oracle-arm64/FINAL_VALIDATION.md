# Validation Oracle A1 — état vérifiable, 27 octobre 2026

## Ce qui est corrigé

* Zod 4.5.4 → 4.6.6 par override ciblé et lockfile. Remotion reste 4.0.530.
  Les dix alertes npm étaient une vulnérabilité source propagée dans dix nœuds.
  `npm audit --omit=dev` retourne désormais zéro alerte. Les 77 tests worker,
  dont la régression sur collection surdimensionnée, passent.
* Cela ne corrige pas la copie Zod 4.5.4 vendue dans le bundle
  `@remotion/studio-protocol`. Le worker Alex ne lance pas Studio et n'expose
  que ses routes de santé ; ne pas ouvrir Studio sur Internet. Aucun downgrade
  Remotion ni patch artisanal de son bundle n'a été appliqué. La sécurité de
  l'application entière n'est pas déclarée validée.
* Packaging : propriétaires `node` à la copie, sans grosse couche `chown -R`.
  Export OCI directement sur disque, sans `--load` et sans publication registre.
  Le contexte exclut vidéos, archives, fichiers `.env`, caches et node_modules.
  **Construction et export réussis** : archive locale
  `/workspace/scratch/socialplus-alex-arm64.oci.tar`, 1 003 044 352 octets.
  Les 14 blobs et leurs tailles/hashes ont été vérifiés ; Linux ARM64, utilisateur
  `node`. Le manifeste est
  `sha256:be1a8bed9f7801ad537b27d82db5daf2e2adf4e57fe0b913ffd628d1540573d1`.
  Les tests en construction QEMU passent : imports Python/Alex/Remotion,
  import non privilégié, 13 tests graphiques Python, encodage et décodage
  H.264/AAC synthétiques. Voir `native-preparation-results.json` et
  `oci-build-evidence.log`. L'archive ne contient ni rush ni clé utilisateur.
* Banc natif : limite 2 CPU / 8 Go sans swap additionnel, réseau désactivé,
  aucun secret, fichier source en lecture seule, un test par utilisateur,
  refus avant lancement si moins de 6 Gio de disque libre. Ce seuil est un
  garde-fou initial, pas une garantie contre tout remplissage de disque.

## Mesures préparées, pas inventées

Le banc enregistre la durée source, le temps total, le CPU moyen et le maximum
échantillonné à environ une seconde, le pic RAM cgroup (avec processus enfants
et cache), le pic échantillonné de l'espace de travail et la taille finale.
100 % CPU « core » désigne un CPU ; 200 % correspond aux deux CPU autorisés.
Une valeur absente est inconnue, pas zéro. Il conserve aussi l'état OOM/exit.
Le disque de l'image et la taille du fichier source sont comptés séparément.

Les quatre tests de télémétrie et cinq tests du vérificateur OCI valident les
outils, pas les performances d'Oracle. Les tests de données synthétiques ne
certifient aucune parole, fluidité ou fidélité visuelle d'un vrai montage.

## Blocages factuels du test demandé

1. L'environnement disponible est x86_64. Aucun compte Oracle, identité cloud,
   hôte A1 ou accès SSH Oracle n'est configuré. Il est donc impossible ici de
   vérifier une allocation Always Free réelle, lancer un rendu ARM64 **natif**
   ou mesurer le coût/les ressources de cette instance.
2. Les rushs parlés bruts retrouvés mesurent 512×910 (27,166992 s) et 910×512
   (47,1 s). Le moteur conserve leur format natif. Ils ne permettent pas de
   certifier une sortie 1080p native. Aucun upscale masqué ni modification du
   moteur n'est ajouté pour transformer cette limite en faux succès.
3. Le test d'import authentifié sur Oracle exige le backend de test, son projet
   Supabase Free isolé et son compte de test. Le benchmark hors ligne ci-dessous
   teste le moteur ; il ne remplace pas connexion → import → rendu → téléchargement.

**Aucun nouveau MP4 Oracle A1, temps de rendu A1, pic CPU/RAM A1, débit utilisateurs
ou nombre de rendus simultanés supportés n'est annoncé comme mesuré.**
Un seul rendu est autorisé par le banc ; sa capacité réelle reste à mesurer.

## Procédure unique pour terminer sur Oracle, après accès autorisé

Conserver Oracle comme cible. Ne pas créer d'instance alternative ni utiliser les
crédits d'essai pour payer une forme dépassant Always Free.

1. Le propriétaire crée/vérifie son compte Oracle (identité et carte admissible),
   conserve le compte gratuit sans mise à niveau, puis vérifie la disponibilité
   d'une A1 **Always Free Eligible**, région principale, 2 OCPU/12 Go maximum.
   Compter tous les volumes existants dans les 200 Go gratuits ; prévoir 100 Go
   pour cette VM si le quota disponible le permet. Aucun achat de domaine,
   licence OS, service réseau ou disque hors quota n'est autorisé.
2. Configurer un accès SSH autorisé dans l'environnement sécurisé. Ne jamais
   envoyer de clé privée ou de secret dans le chat/GitHub. Les médias sont
   transférés par SSH privé, jamais via le dépôt public ou ses artefacts.
3. Construire une archive sur un builder compatible OCI avec assez de disque :

   ```bash
   bash deploy/oracle-arm64-validation/build-oci.sh /chemin/prive/alex.oci.tar
   ```

   Le builder et les commandes doivent utiliser la confiance CA/proxy de leur
   environnement. Le build n'active aucun worker. Le vérificateur contrôle les
   hashes des blobs, Linux ARM64 et l'utilisateur non privilégié ; il ne prouve
   pas un démarrage sur du matériel natif.
4. Sur A1, charger l'archive vérifiée, par exemple avec `skopeo` (outil libre)
   vers Docker, sans registre public ni reconstruction du moteur :

   Utiliser le compte SSH non privilégié UID 1000 (par défaut `ubuntu` sur
   l'image Ubuntu), avec accès Docker autorisé. Le banc refuse root ou un UID
   différent : les fichiers privés montés doivent être lisibles/inscriptibles
   par le même UID que `node` dans l'image. Toute autre correspondance d'UID
   doit être préparée explicitement, sans ouvrir les médias en lecture publique.

   ```bash
   skopeo copy oci-archive:/chemin/prive/alex.oci.tar docker-daemon:socialplus-alex:oracle-arm64
   bash deploy/oracle-arm64-validation/benchmark.sh \
     socialplus-alex:oracle-arm64 /chemin/prive/rush-original.mov /chemin/prive/test-neuf
   ```

5. Contrôler `benchmark.json`, `container-state.json`, les plans et le MP4 :
   une piste audio, durée/dimensions, décodage, cuts, sous-titres et animations.
   Le champ `atLeast1080p` reste faux si la source conservée est sous 1080p.
   Une transcription marquée à vérifier ne devient pas validée par cet export.
6. Ensuite seulement, tester le parcours authentifié de l'application existante
   sur une préproduction isolée. L'interface Next ARM64, HTTPS, le stockage et
   l'import cloud complet restent à tester ; ce banc n'affirme pas le contraire.

## Gratuité et capacité

* Oracle Always Free : 1 500 OCPU-h et 9 000 Go-h/mois (2 OCPU/12 Go),
  200 Go de volumes dans la région principale, cinq sauvegardes de volumes,
  10 To de trafic sortant/mois. Capacité A1 non garantie. Une instance jugée
  inactive sur sept jours peut être récupérée. Ne pas générer de charge fictive
  pour masquer l'inactivité : prévoir sauvegardes et restauration.
* À allocation constante sur 31 jours, 2 OCPU/12 Go représentent 1 488 OCPU-h
  et 8 928 Go-h ; cela tient dans ces quotas **si aucune autre A1 ne les consomme**.
* Coût conditionnel : 0 €/mois seulement avec les ressources réellement
  étiquetées gratuites et un compte non mis à niveau. Aucun devis/usage réel du
  compte Oracle n'a pu être consulté sans accès. La carte peut faire l'objet
  d'une autorisation temporaire de vérification, pas d'un abonnement activé ici.
* Supabase : conserver un projet réellement Free et isolé (DB 500 Mo, Storage
  1 Go, egress 5 Go et cache distinct, maximum 50 Mo par objet, pause possible
  après inactivité). Un export unique >50 Mo peut donc bloquer, même si l'import
  source découpé réussit. R2 n'est pas activé : ses dépassements sont facturables.
* Vercel Hobby n'est pas retenu comme dépendance commerciale durable. L'interface
  existante doit être servie sur Oracle ; son build ARM64 reste à valider.
* Pas d'autoscaling, de paiement, de service facturé ou d'augmentation de plafond.
  La rétention distante automatique, la supervision des quotas et la restauration
  des sauvegardes ne sont pas encore validées. Le nombre de testeurs accueillables
  ne peut pas être déduit du quota RAM ou d'un test unitaire.

Sources officielles consultées :

* https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
* https://www.oracle.com/cloud/free/faq/
* https://supabase.com/pricing
* https://supabase.com/docs/guides/storage/uploads/file-limits
* https://developers.cloudflare.com/r2/pricing/
* https://vercel.com/legal/terms
* https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
