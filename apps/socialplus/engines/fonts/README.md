# Polices de rendu distribuables

Les fichiers TTF de ce dossier sont des sous-ensembles modifiés de fontes libres **SIL OFL 1.1**. Les trois licences et avis de copyright sont fournis ici. Les familles modifiées portent des noms distincts ; le nom réservé Lato n’est pas utilisé comme nom de famille des sous-ensembles.

| Ancien fichier demandé | Résolution embarquée |
| --- | --- |
| Inter-Regular.otf | SocialPlusSans-Regular.ttf, Inter actuel, graisse 400 |
| Inter-Medium.otf | SocialPlusSans-Medium.ttf, Inter actuel, graisse 500 |
| Inter-SemiBold.otf | SocialPlusSans-SemiBold.ttf, Inter actuel, graisse 600 |
| InterDisplay-SemiBold.otf | SocialPlusDisplay-SemiBold.ttf, Inter actuel, graisse 600 et axe optique 32 |
| EBGaramond08-Regular.ttf | SocialPlusSerif-Regular.ttf, EB Garamond actuel, graisse 400 |
| Lato-Medium.ttf | SocialPlusHumanist-Regular.ttf, alternative Lato Regular 400 |
| Lato-Regular.ttf | SocialPlusHumanist-Regular.ttf, Lato Regular 400 |

Les variantes Bold et ExtraBold d’Inter sont aussi présentes pour la hiérarchie Cinematic. Il s’agit d’alternatives autorisées, pas de la récupération exacte de toutes les anciennes versions. La géométrie et les métriques peuvent donc différer des masters. Le jeu couvre le latin européen, la ponctuation et les signes/traits utilisés par les scènes ; la couverture Unicode intégrale n’est pas revendiquée.

`manifest.json` contient les empreintes SHA-256 des sources, des fichiers générés et leur correspondance. Aucun téléchargement n’a lieu pendant un rendu. Pillow lit directement ces TTF ; FFmpeg reçoit `fontsdir` et le navigateur Kinetic reçoit les fontes en mémoire. Une police embarquée absente doit provoquer une erreur explicite, jamais une substitution silencieuse.

Pour reconstruire en développement : fournir les sources Google Fonts correspondant aux empreintes du manifeste à `python engines/build_fonts.py DOSSIER_SOURCES` avec fontTools installé. Le serveur n’a pas besoin de fontTools. Conserver les licences avec les TTF lors de toute redistribution.
