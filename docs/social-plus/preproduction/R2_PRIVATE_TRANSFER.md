# Transfert R2 privé pour le test Alex — préparation, 27 octobre 2026

## État vérifiable

Railway retourne `valuesRedacted: true` et les noms `R2_ACCOUNT_ID`,
`R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENABLED`.
**Le nom réel du bucket n'est pas lisible.** Les identifiants de code
`socialplus-r2` et les fixtures `socialplus-test` ne sont pas ce nom réel.

Aucun outil Cloudflare connecté, secret R2 ou identité Cloudflare n'est
configuré dans cette tâche. Le contrôle local s'arrête avec
`R2_MANAGEMENT_ACCESS_NOT_CONFIGURED`, avant tout appel Cloudflare.
Bucket, confidentialité, CORS, lifecycle, stockage Standard et quotas réels
restent non vérifiés. Aucune URL utilisable n'est générée, aucun objet transféré,
aucun workflow lancé. Aucun service/bucket n'est créé ou modifié.

## Accès à configurer hors du chat et du dépôt

Via l'environnement sécurisé de la tâche :

* `R2_ACCOUNT_ID`, `R2_BUCKET_NAME` : compte et bucket existants ;
* `CLOUDFLARE_API_TOKEN` : lecture de la configuration R2 concernée ;
* `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` : accès S3 limité à ce bucket.

Ces clés restent uniquement côté signataire, jamais dans le workflow Actions.
Aucun jeton GitHub de livraison n'est nécessaire. Les valeurs masquées dans
Railway ne sont ni extraites ni remplacées.

## Contrôle sans changement de configuration

```bash
mkdir -m 700 /chemin/prive/socialplus-r2
node apps/worker/ci/prepare-r2-transfer.mjs inspect /chemin/prive/socialplus-r2/inspection.json
```

L'outil lit le bucket, ses domaines r2.dev/personnalisés, CORS et lifecycle.
Il refuse les domaines publics activés, un stockage non confirmé Standard ou
une réponse inconnue. Il ne modifie aucune règle. CORS/lifecycle absents sont
notés comme tels ; CORS n'est pas requis pour ces échanges serveur-à-serveur.
Les Workers/proxys pouvant exposer le bucket ne sont pas audités par ces seuls
endpoints : leur absence/protection doit aussi être confirmée. Une juridiction
non standard est arrêtée pour vérifier son endpoint avant signature, car le
signataire existant utilise l'endpoint global R2.

## Signature locale, une heure et un objet par URL

```bash
node apps/worker/ci/prepare-r2-transfer.mjs sign /chemin/prive/socialplus-r2/transfert.json
```

Les fichiers sont créés en mode 0600, dans un dossier 0700 hors du dépôt.
Les URLs ne sont jamais imprimées. Le manifeste contient des capacités GET/PUT
distinctes, limitées aux objets exacts `socialplus-ci/<UUID>/source.mov`,
`alex.mp4` et `proofs.zip`, avec `X-Amz-Expires=3600`. Ni liste ni suppression.
Le PUT du rush reste dans le fichier contrôleur, pas dans les capacités runner.

**Un lien est réutilisable jusqu'à expiration ; il n'est pas à usage unique.**
L'expiration du lien ne supprime pas le fichier. La rétention dépend des règles
existantes, qui ne sont pas modifiées. Les URLs sont des secrets bearer : ne pas
les publier dans le chat, une PR ou un input de workflow public.

## Validation effective avant toute exécution

La marge dans les quotas gratuits doit d'abord être vérifiée dans le compte R2.
R2 peut facturer les dépassements ; aucun plafond automatique à 0 € n'est supposé.
Le contrôleur exige une confirmation opérateur avec référence avant toute
opération S3 (cela ne constitue pas une lecture automatique de facturation) :

```bash
R2_FREE_USAGE_CONFIRMED=true R2_BILLING_EVIDENCE='reference-du-controle-effectif' \
node apps/worker/ci/prepare-r2-transfer.mjs validate \
  /chemin/prive/socialplus-r2/transfert.json /chemin/prive/rush-existant.mov
```

Il envoie le véritable rush de taille/hash fixés, puis le relit et contrôle son
SHA-256. Aucun faux MP4 vide n'est utilisé comme sonde. Cela vérifie la lecture
et l'écriture du bucket ; la disponibilité du MP4 final ne sera confirmée
qu'après sa génération, son envoi et sa relecture.

Le manifeste initial a `accessesValidated=false` et ne permet pas de démarrer.
Après succès, `transfert.json.validated.json` est créé. Aucun workflow n'est
lancé automatiquement. Si ces validations échouent, ne pas poursuivre.

## Remise confidentielle à Actions et récupération

Le propriétaire place le JSON validé dans le secret Actions temporaire
`SOCIALPLUS_R2_TRANSFER`, sans clé S3 ni jeton GitHub. Cette connexion ne peut
pas gérer les secrets Actions (HTTP 403) ; il faut un accès autorisé du
propriétaire pour cette configuration. Ne pas utiliser un input public.

Le runner refuse un démarrage plus de dix minutes après signature ; le job est
borné à 25 minutes. Les liens sont fournis aux seules étapes de transfert. Le
calcul Alex reçoit uniquement les fichiers locaux, sans liens ni clés.
Le workflow mode `alex` est préparé pour R2, mais **aucune exécution n'a été
lancée dans cette mission**. Le MP4 et les preuves sont envoyés via PUT dédiés,
relus et vérifiés par SHA-256. Aucun artefact public n'est téléversé.

Les GET de récupération sont conservés dans le fichier contrôleur privé. Le
propriétaire peut également télécharger les objets dans son tableau de bord
Cloudflare authentifié. Après expiration, il faut une nouvelle signature ou
l'accès au compte, sous réserve de la rétention existante.

Tests locaux : 8 tests de signature/périmètre/expiration et 2 tests de
configuration simulée passent. **Les simulations ne vérifient aucun bucket réel.**
Les six moteurs de montage sont inchangés.

Sources :

* https://developers.cloudflare.com/r2/api/s3/presigned-urls/
* https://developers.cloudflare.com/api/resources/r2/
* https://developers.cloudflare.com/r2/pricing/
