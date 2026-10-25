# Social+ V2 — résultats et verdict

**Verdict : non commercialisable. Score de validation : 79/100, contre 77/100 avant cette passe.** Deux points acquis pour la reprise après arrêt de processus réellement exécutée. Les 21 autres points restent non validés. Ce score hérité mesure une couverture de preuves, pas une qualité commerciale générale. Les modèles ont leurs propres scores conservateurs dans `MODELS.json` : aucun 100/100.

## Défauts corrigés, preuves exécutées

- C1 : nouveau média et ancien nettoyage séparés. Une erreur de suppression de l’ancien fichier ne détruit plus le nouveau média publié. Publication projet/tâche transactionnelle ; fichiers de nettoyage en attente suivis dans SQLite.
- C2 : fichier vide refusé ; export absent signalé comme indisponible par l’API, la bibliothèque et le téléchargement. Un ancien résultat remplacé ne se fait pas passer pour le résultat courant.
- M1/M2 : paramètres privés persistés pour reprise bornée ; nouveau fichier de sortie par tentative, source contrôlée par SHA-256, une seule reprise automatique, clé d’idempotence liée à la source et aux paramètres, quota non reconsommé. Une deuxième instance utilisant les mêmes données est refusée. Les paramètres complets sont purgés du descripteur terminal pour éviter la duplication durable des transcriptions.
- Suppression de compte : rendu actif annulé et attendu avant nettoyage ; échec physique signalé au lieu d’annoncer une suppression achevée. Fichiers orphelins générés par l’application et `.part` récupérés au démarrage, uniquement dans son dossier média.
- Fermeture d’une prévisualisation : lecture vidéo mise en pause, y compris fermeture native du dialogue. Le guide de zone graphique est visible sur la source pour Codie/Leila/Kinetic ; il ne prétend pas détecter une main ou un visage.
- Codie : déclenchement « argent » corrigé pour une élision avec apostrophe, sans modifier les paroles ni le moteur graphique.

Suite complète : **119/119 tests réussis** (`full-tests.log`), puis deux tests supplémentaires ajoutés et réussis en ciblé : isolation des repères éditoriaux (`editorial-tests.log`) et échec transactionnel de publication (`publication-recovery-final.log`). Les suites ciblées se recouvrent : ne pas additionner leurs totaux. Le test d’arrêt de processus utilise une vraie conversion FFmpeg, une terminaison du processus, la même base et un décodage final, pas une simple promesse de reprise. Les tests de panne UI utilisent une doublure explicitement signalée, jamais présentée comme un moteur réel.

## Analyse ajoutée, sans promesse fictive

Repères locaux sur ouverture transcrite, phrases longues, hésitations, connecteurs, débit approximatif, pauses, niveau/pic audio et marqueurs de CTA. Chaque constat fournit le moment, la preuve, pourquoi, comment agir et comment vérifier l’amélioration. Les textes viennent seulement de la transcription du fichier privé du membre ; les paramètres client ne peuvent pas inventer le discours. Version et empreinte rendent le résultat reproductible.

Les citations ASR restent provisoires. Aucun score global sémantique, rétention chiffrée, originalité, lisibilité pixel des sous-titres ni cohérence visuelle n’est fabriqué. Si ASR est indisponible ou son quota atteint, les mesures acoustiques restent affichées avec l’erreur explicite. Aucun nouveau modèle IA ni service externe : seulement Whisper déjà installé et règles locales. Les coûts réels de calcul/énergie ne sont pas assimilés à zéro.

## Démonstration réelle

Parcours exécuté dans Chromium tactile : vrai extrait parlé → import unique → analyse acoustique et nouveaux repères → même projet → préparation → Leila → navigation/reprise → lecture et téléchargement MP4. Format 910×512, une piste AAC originale, décodage intégral et corrélation PCM vérifiés. Export vertical **technique synthétique** distinct ; pas de faux rush parlé vertical. Six largeurs sans débordement et aucune erreur JavaScript non interceptée. Les preuves structurées sont dans `REAL_FLOW.json` et `RECOVERY_UI.json`.

Sur le rush parlé complet de 47,1 secondes : cinq nouveaux rendus horizontaux et Cinematic existant inchangé. Six MP4 décodés et lus dans la bibliothèque authentifiée, chacun avec progression de lecture et images décodées. Une pause de 1453 ms retirée avec les garde-fous existants. Deux segments audio par modèle : corrélation minimale >0,9995. Trois échantillons caméra par modèle : meilleur appariement au décalage temporel attendu, erreur moyenne de luminance <2/255. Ces échantillons ne certifient pas toute la synchronisation labiale ni les mots.

Les six masters disponibles ont été comparés visuellement sur des planches privées. Les écarts sont consignés individuellement dans `MODELS.json` : choix d’ancrages statiques en présence de gestes, hiérarchie et grammaire graphique partiellement différentes, preset Spatial focus dominant. Il ne s’agit pas d’une comparaison exhaustive de toutes les transitions ni d’une validation sonore humaine. Les premiers essais de lecteur automatisé ont attendu trop tôt un dialogue encore remplacé ; l’attente de la vraie fenêtre a été corrigée, sans modifier ni réencoder les MP4.

## Blocages restants

- **Critique commercial** : 19 entrées de transcription et quatre groupes fusionnés non certifiés, deux désaccords contextuels supplémentaires antérieurs ; aucune nouvelle confirmation phonétique inventée. Les 19 extraits privés existants sont conservés.
- **Majeur artistique** : six adaptations bêta utilisables pour essai privé, fidélité complète non certifiée. Les échantillons montrent des écarts ; les captions/gestes/direction narrative doivent être validés sur tout le rendu.
- **Source manquante pour recette** : aucun nouveau rush parlé **vertical natif** identifié. Aucun recadrage artificiel n’a été créé pour le remplacer.
- **Matériel** : Safari iPhone, partage OS, Dynamic Island, VoiceOver, clavier et performance sur téléphone physique non exécutés. Les viewports Chromium ne les remplacent pas.
- **Analyse** : compréhension automatique de la promesse, du message et de la narration absente ; les repères textuels ne sont pas ce moteur.
- **Commercial** : abonnements, accès payants et promotions commerciales non implémentés ; codes d’invitation privés opérationnels. Informations juridiques et revue de conservation non complétées. Tarifs de machine, énergie, hébergement et volume réels inconnus ; `COSTS.json` sépare mesures et montants indisponibles.
- **Infrastructure** : worker local unique, une reprise réencode depuis le début. La supervision des processus système et la sauvegarde/restauration en service public restent à concevoir/recetter. Un arrêt brutal peut laisser des temporaires internes d’un sous-processus ; pas de certification d’exploitation de production.

Aucun déploiement ni paiement activé. PR #53 inchangée, PR #55 non fusionnée. Les vidéos, transcriptions, extraits sonores, planches comparatives et secrets restent hors du dépôt public. Les seuls JSON publics sont des mesures et constats sans citations personnelles.
