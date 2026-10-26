# Alex V16 — deux discours réels, validation encore incomplète

| Essai | Résultat réel | Réserves |
|---|---|---|
| Vertical natif, vente, 27,167 s | MP4 complet 512×910, 815 images, trois compositions liées aux paroles | Cinq mots non confirmés ; fidélité portrait à approuver |
| Horizontal natif, productivité, 47,1 s | MP4 complet 910×512, 45,3 s, 1 359 images ; silence de 1,811 s retiré | Vingt entrées ASR signalées dont quatre groupes sans frontière mot à mot |
| Troisième rush indépendant | Non exécuté | Introuvable dans les fichiers accessibles |

Aucun master monté utilisé comme entrée de ces exports. Les transcriptions sont issues de l’ASR locale et réutilisées depuis un cache lié à l’empreinte du rush ; aucun texte, plan ou timing de montage n’a été saisi manuellement pour produire ces deux MP4. Le MOV de 6,067 s trouvé dans `interface-preview/rush-test.mov` n’est pas un troisième discours : la corrélation de ses cinq premières secondes audio avec le rush horizontal de 47 s est exactement 1,0. L’ancien fichier joint `SOCIALPLUS_RUSH_BRUT_PARLE_25S.mov` n’est plus accessible à son chemin d’import ; ses montages déjà exportés ne sont pas des rushs bruts de remplacement. Un troisième brut indépendant reste nécessaire.

## Changements effectués

Le planificateur v2 détecte désormais des relations extractives de discours : opposition explicite, négation suivie d’une alternative, effet fonctionnel et énumération verbale. Il sélectionne un jeu de scènes non chevauchantes, dans l’ordre du discours. Les titres, légendes et instants d’activation proviennent des indices de mots du rush ; les phrases du premier essai ne sont plus nécessaires. Les tests couvrent aussi six cas synthétiques, qui ne sont pas comptés comme rushs réels.

Les trois compositions restent celles de la reconstruction : cercles, nœuds, flèches, palette et courbes ease-in/ease-out. Les légendes longues se répartissent sur deux lignes, avec minimum lisible explicite ; les titres portrait restent à 24 px minimum. Le détecteur n’utilise pas « écouter » comme preuve de coût, ne dessine l’euro qu’avec un contexte financier proche et refuse un jeu de relations absent/ambigu. Ces règles sont des heuristiques françaises, pas une compréhension sémantique universelle ni une validation du sens par un humain. Une énumération n’est pas présentée dans les preuves comme une causalité démontrée. La validation visuelle et éditoriale reste nécessaire.


## Validation technique et blocages

73 tests Node, 13 tests Python réussis. Build Next réussi ; 19 tests de contrat navigateur existants et le nouveau test de relecture réussis (celui-ci après correction d’un sélecteur ambigu). Deux MP4 réellement décodés et inspectés ; cadence régulière à 30 fps. Contrôle de pixels : 107 unités verticales et 152 unités ASR horizontales présentes. Quatre unités horizontales regroupent plusieurs mots : aucun alignement mot à mot certifié. AAC vertical identique ; audio horizontal original découpé/réencodé puis copié, corrélation d’ondes 0,988–0,999 avec le trim attendu, décalage mesuré 13,31 ms après le cut. Pas de doublage/filtre de tonalité.

Comparaison privée des trois scènes avec la référence réalisée : géométrie/palette/courbes conservées, wraps lisibles ; métriques exactes de la police historique non récupérées. Fidélité et compréhension éditoriale non approuvées. Les règles extractives peuvent se tromper et ne constituent pas une compréhension universelle du discours.

Les cinq mots verticaux restent à confirmer. Seconde passe hors ligne exécutée ; elle ajoute une hypothèse de négation sur un passage, non appliquée sans preuve. Vingt signalements sur l’horizontal, dont quatre groupes sans frontières individuelles. Détails, extraits et hypothèses conservés uniquement dans les livrables privés.

La véritable interface Next a été ouverte sans routes interceptées : connexion obligatoire, requête de stockage anonyme refusée en 401. Le parcours connecté complet n’est pas testé : pas de compte/session de test ou de backend isolé activé. Les 20 tests de contrat ne prouvent pas le backend déployé. Safari physique non disponible ; aucune émulation Chromium n’est appelée Safari.

Aucun troisième rush indépendant trouvé ; le fichier de 6 s réutilise exactement le début audio du 47 s. Alex reste désactivé par défaut, PR #58 non fusionnée et référence Git non mise à jour pour éviter le hook de production. Aucun déploiement, nouvelle infrastructure payante ou média personnel public.
