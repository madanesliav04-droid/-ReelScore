# Interface Social+ — prévisualisation locale

Branche isolée `codex/socialplus-testable-interface-20261024`. Aucun déploiement, aucune fusion, aucun service payant. PR #53 conservée.

## Essai réellement exécuté

Chromium avec viewport et agent utilisateur iPhone 13, sur un serveur HTTP local isolé avec authentification propriétaire/MFA. Source : extrait de six secondes du rush parlé utilisateur, sans modification du fichier original.

1. Import par Analyse → sauvegarde privée → mesures FFmpeg → indices et critères exclus affichés.
2. Passage au même projet dans Montage → transcription Whisper locale → choix Leila V53 → préparation des événements → confirmation du placement et mode transcription non validée → rendu réel → lecture et téléchargement MP4.

Export de 733497 octets ; vidéo 910×512 H.264, audio AAC stéréo avec une seule piste. Lecture avancée à 1,459694 seconde sans erreur. Pas d’erreur JavaScript non interceptée, pas de débordement horizontal au contrôle desktop. Captures iPhone et PC conservées dans le workspace privé, exclues du dépôt public car elles contiennent le rush utilisateur.

Le test ne certifie ni la phonétique ni la fidélité des six modèles. Un seul modèle a été rendu dans cette passe ; les autres essais antérieurs n’ont pas été relancés. Le raccord web Cinematic autonome, la transmission des entrées à revoir et la reprise des tâches sont contrôlés par test de service avec doublure de renderer explicitement identifiée, sans prétendre à un nouveau rendu Cinematic.

## Contrôles ciblés

- Première passe : 50 tests réussis (projets, analyse acoustique, Stratégie, intégration HTTP).
- Après raccord Cinematic : 22 tests réussis (dont plusieurs déjà présents dans la première passe).
- Après reprise des tâches et nouveau test de raccord : 10 tests projets réussis. Ne pas additionner ces totaux : les suites se recouvrent.
- Les formules acoustiques sont déterministes et testées ; les scores éditoriaux restent non évaluables sans preuves documentées.

## Limites

Les six ports existants sont raccordés en bêta. Ils ne sont pas certifiés fidèles aux six masters. La transcription de Cinematic reste à vérifier ; aucun drapeau ne la certifie commercialement. L’analyse automatique du hook, du sens, de la clarté et des CTA n’est pas disponible : seuls les signaux acoustiques sont mesurés automatiquement, la revue éditoriale existante reste explicite et manuelle.

Safari sur iPhone physique non testé. Aucune URL HTTPS externe n’est fournie par cet environnement ; le serveur local seul n’est pas joignable depuis un iPhone distant. Il faut autoriser et configurer un accès de prévisualisation privé séparé avant une recette personnelle à distance.
