# Recette locale des six adaptations

Le banc d’essai réutilise un fichier **déjà présent**. Aucun upload ni appel de transcription, de génération ou de modèle distant n’est effectué. Il ne débite pas le quota des comptes de l’application. Les vidéos, plans relus et résultats restent dans `apps/socialplus/.data/model-qa`, ignoré par Git. Les sources historiques demeurent inchangées.

Depuis `apps/socialplus`, après `npm ci`, Node 24, Python/numpy/Pillow, FFmpeg et Chromium :

```sh
npm run verify:models -- --prepare /chemin/du/rush.mov
```

Cette préparation lit les métadonnées et calcule le SHA-256 sans rendu. Elle crée `.data/model-qa/plan-to-review.json` avec transcription vide, sans mot ni emplacement inventé ; un plan existant n’est jamais écrasé. Pour un autre rush, utiliser un autre dossier de sortie. Lire le fichier réel avant de confirmer `speechReviewed`, renseigner la transcription alignée (`text`, `start`/`end` en secondes ou `startMs`/`endMs`) puis confirmer `captionsReviewed`. Pour chaque modèle, renseigner `events` et confirmer `placementReviewed` après examen des images. Ces confirmations ne sont pas une preuve automatique de qualité.

Les événements utilisent `wordIndex`, `wordCount` facultatif, `endMs` facultatif et `rect: [x,y,largeur,hauteur]` normalisé. Les validations existantes s’appliquent : texte réellement prononcé, zone sûre et événements sans chevauchement. Codie exige le mot « temps » avec `kind: "clock"` ou « argent » avec `kind: "euro"` ; Social Kinetic exige `kind: "bubble"` ou `"hero"` ; Alex utilise la bande haute `[0.15,0.05,0.7,0.2]`. Cinematic utilise une séquence plein écran, sans rectangle fourni. Un rush sans déclencheur pertinent peut laisser un modèle bloqué : ne pas ajouter de faux mots pour satisfaire le test. Limites des adaptations : 60 secondes et 1080p natif.

```sh
npm run verify:models -- /chemin/du/rush.mov .data/model-qa/plan-to-review.json
```

Les modèles s’exécutent successivement. Une entrée manquante bloque seulement le modèle concerné ; une panne n’empêche pas les suivants. Le rapport `report.json` conserve chaque résultat et le statut `releaseApproved: false`. Le cache lie le rush, les mots/placements, le modèle, les sources du moteur, les dépendances verrouillées et les paramètres de runtime. Le SHA-256 de chaque export est revérifié avant réemploi. Un résultat manquant, modifié ou issu d’un plan/moteur différent est recalculé ; un résultat intact est réutilisé. Ne pas partager ce dossier privé dans un dépôt public.

`passed_technical_checks` signifie que l’adaptateur a produit un MP4 et passé ses contrôles techniques. Cela ne prouve ni la fidélité au master, ni l’écoute au casque, ni l’exactitude des mots, ni la recette sur trois nouveaux rushs. Les tests automatisés du cache utilisent un renderer simulé explicitement ; ils ne constituent pas des essais sur parole.

Les versions des exécutables système, des paquets Python et des polices ne sont pas incluses dans l’empreinte du code. Après leur mise à jour, ajouter `--fresh` pour recalculer les six sorties : `npm run verify:models -- --fresh /chemin/du/rush.mov .data/model-qa/plan-to-review.json`. Le navigateur configurable est `SOCIALPLUS_CHROMIUM`, identique à celui du moteur Social Kinetic ; son chemin participe à la clé de cache.

La recherche du 23 octobre est documentée dans [RUSH_DISCOVERY_20261023.md](RUSH_DISCOVERY_20261023.md). Des candidats sont enregistrés dans le stockage privé, mais le contenu reste inaccessible (HTTP 402 quota de stockage, avec session média également requise). Aucun rush parlé n’a donc été déclaré testé dans cette session. La reprise utilise ces fichiers existants dès qu’ils sont accessibles, sans demander leur réenvoi.

Vérification locale du 23 octobre : les quatre tests du cache passent ; la commande de préparation a lu une fixture technique préexistante et créé un plan vide sans rendu ; l’exécution avec ce plan non relu a correctement bloqué les six modèles (code de sortie 2). La suite complète compte **89 tests réussis**, dont les exports techniques synthétiques existants ; journal dans `artifacts/experiments/unit-tests.log`. Le préflight Node/SQLite/FFmpeg H.264/AAC/libass passe. Ces résultats n’ajoutent aucune preuve de parole réelle.
