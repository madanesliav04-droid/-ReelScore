# Social+ — nouvelle expérience mobile

**Score de validation : 77/100 ; 23 points non validés.** Les critères et preuves sont détaillés dans `score.json`. Il s’agit d’une couverture de validation, pas d’une mesure de fidélité artistique ou d’un certificat de commercialisation.

## Fonctionnel

Quatre espaces : Accueil, Montage, Analyse et Projets. Import automatique avec progression réelle d’envoi, même vidéo réutilisée sans réimport, sélection des six modèles conservés, propositions recalculées lors du changement de modèle, revue des mots avec écoute et édition, JSON avancé replié. Résultat lisible, téléchargement MP4 et préparation du partage OS si le navigateur l’accepte. Bibliothèque avec statuts, prévisualisation, options et suppression. Sessions, MFA, contrôle d’origine/CSRF, administration, FAQ, avis et support existants conservés.

Les tâches de rendu sont retrouvées après navigation ou rafraîchissement. Une panne réseau permet de réinterroger la même tâche. La source reste disponible après un échec. Aucun moteur ni ses graphismes, animations ou règles n’a été remplacé. Le serveur reste la source de vérité ; aucun média ni secret n’est conservé dans sessionStorage (uniquement l’identifiant du projet courant, lié au compte).

Le diagnostic automatique porte sur des **mesures acoustiques**. Son indice v1 est la moyenne des sous-scores disponibles, avec formules et version du moteur affichées. La revue éditoriale manuelle existante est conservée, sans prétendre à une analyse sémantique automatique. Une pause peut être intentionnelle : les coupes exigent une sélection et les garde-fous des moteurs. Cinematic reste bêta — transcription à vérifier.

## Tests réellement exécutés

- Suite serveur existante : **107 tests réussis**. Elle inclut les six compositeurs sur fixtures vidéo techniques avec export réel ; cela ne certifie pas les six masters. Les moteurs n’ont pas changé, cette suite n’a pas été répétée ensuite.
- Nouveaux tests client : **5 réussis**, couvrant l’adaptateur même origine et ancienne session, envoi mesuré/CSRF/annulation/erreur, échappement HTML des mots et incertitudes, score explicable déterministe et statuts des projets.
- Nouveau parcours navigateur, Chromium tactile 402×874 : vrai extrait parlé → import unique → analyse répétée stable → même projet → transcription locale Whisper → sélection des six modèles → rendu Leila réel → navigation Projets et retour → lecture MP4 → téléchargement et décodage complet. Format natif 910×512, une piste audio AAC stéréo. Corrélation PCM des quatre premières secondes : 1.000 dans cet essai. Aucun contrôle phonétique humain revendiqué.
- Un export technique vertical distinct 360×640 a été effectué sur une fixture **synthétique** explicitement identifiée ; pas de prétendue parole ni de fidélité artistique sur cette fixture.
- Quatre espaces vérifiés sans débordement aux largeurs 320, 390, 402, 440, 768 et 1440 px. Cibles de navigation ≥44 px ; champ/select mesuré à 16 px pour éviter le zoom Safari. Thème clair/sombre et mouvement réduit contrôlés. Aucune erreur JavaScript non interceptée.
- Test de récupération séparé avec **panne de renderer injectée**, pas un faux test moteur : pause mesurée et sélection transmise, perte réseau/réinterrogation, échec affiché, source conservée, rafraîchissement, suppression, FAQ préservée. Ce test n’est jamais présenté comme un rendu réussi.

Les JSON `real-flow.json` et `recovery-flow.json` contiennent les preuves structurées. Le parcours réel a été exécuté avant les derniers ajouts isolés d’extraction d’adaptateur et de récupération ; l’adaptateur final a ensuite été testé par unitaires et par le parcours de récupération complet, sans relancer inutilement l’ASR et le rendu parlé inchangés.

## Prévisualisation et limites

`iphone-test-account.png` montre une interface réelle en émulation avec **compte de test vide**, sans vidéo ou identité personnelle utilisateur. Les captures de vrais rushs restent uniquement dans le dossier privé du workspace ; aucun média utilisateur n’est poussé au dépôt public. Les petites mesures de navigation du JSON proviennent du serveur local Linux, pas d’un benchmark iPhone.

Installer/tester cette branche avec `docs/social-plus/WINDOWS_IPHONE.md` et le lanceur HTTPS Windows existant. Aucun serveur public, tunnel, abonnement, déploiement ou migration native n’est activé. Aucun lien distant ne peut remplacer l’adresse Wi-Fi du PC.

Non exécuté : installation Windows native et Safari sur iPhone physique, Dynamic Island/safe areas matérielles, VoiceOver, clavier et texte agrandi, partage natif OS, six montages artistiques verticaux et comparaison complète aux masters. La fidélité phonétique de Cinematic reste à valider. L’analyse automatique du hook/CTA/sens n’existe pas et ne reçoit aucun faux score.

L’orchestration reste locale mono-processus : après redémarrage du serveur, une tâche interrompue devient un échec explicite et peut être relancée, sans reprise automatique à mi-encodage. La future architecture de worker durable et la décision Capacitor sont documentées dans `IOS_PUBLICATION_PLAN.md`. La publication App Store n’est pas démarrée et nécessitera une validation distincte.
