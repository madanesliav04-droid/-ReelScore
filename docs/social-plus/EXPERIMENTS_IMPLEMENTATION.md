# Expériences Stratégie — V18 locale

Lot indépendant des rushs et des moteurs de rendu, correspondant aux sections D16, J, à la phase P3 et à la méthode M12 du cahier V18. Aucun service externe, appel IA, déploiement ou modification de configuration n’est nécessaire.

Dans **Stratégie → Résultats**, le membre prépare une hypothèse, la seule variable qu’il modifiera, un indicateur et une publication de référence. L’API conserve alors une copie de la mesure et un début de test horodaté côté serveur. Une nouvelle publication réalisée après ce début peut ensuite terminer le test, avec une observation de l’utilisateur et ses limites. La référence ne change pas lorsqu’une nouvelle collecte de la publication d’origine est ajoutée.

Les indicateurs disponibles reprennent les formules existantes : partages/portée, enregistrements/portée, engagement complet/portée, visionnage moyen/durée, abonnements attribués/visites et prospects qualifiés attribués/visiteurs suivis. Une référence incomplète est refusée. Les comparaisons de plateformes, fenêtres, définitions, formats ou durées incompatibles sont conservées avec la conclusion « non évaluable », sans écart inventé. Une hausse ou baisse est descriptive : un seul test ne prouve aucune causalité. Aucun score éditorial historique n’est modifié.

Les résultats terminés sont immuables. Une répétition avec la même mesure renvoie le résultat existant ; une autre mesure est refusée. La transition SQLite conditionnelle protège aussi deux clôtures concurrentes. Les expériences appartiennent au membre authentifié et sont incluses dans les fonctions d’export et de suppression Stratégie existantes.

Routes ajoutées :

- `GET/POST /api/strategy/experiments`
- `GET /api/strategy/experiments/:id`
- `POST /api/strategy/experiments/:id/results`

La saisie Performances comprend désormais date **et heure** locales, converties en ISO avec fuseau au moment de l’envoi. Cela permet une publication réalisée le jour du démarrage, sans l’interpréter à minuit. La date d’observation Concurrence est aussi explicite et modifiable.

## Vérification du 23 octobre 2026

- `node --test --test-isolation=none apps/socialplus/server/strategy.test.mjs` : **41 tests réussis**, dont 7 scénarios Expériences couvrant snapshots figés, calcul d’écart, indicateurs non observables, comparabilité, chronologie, isolation, export/suppression, rejeu et clôtures concurrentes.
- `node apps/socialplus/scripts/experiments-smoke.mjs` : parcours Chromium Linux, MFA de fixture, création par formulaire, nouvelle mesure saisie le même jour dans le fuseau Europe/Paris, clôture par formulaire, persistance après rechargement, date Concurrence, affichage PC et viewport iPhone sans débordement horizontal ni erreur JavaScript.
- Captures et rapport : `artifacts/experiments/desktop-experiments.png`, `iphone-viewport-experiments.png`, `smoke-report.json`. Toutes les données du parcours portent des identifiants « Exemple fictif » et résident dans une base éphémère détruite à la fin du test.

Ce contrôle local ne certifie ni Safari sur iPhone physique, ni Chrome Windows, ni la causalité des conclusions, ni les moteurs vidéo. Les 97 scénarios d’acceptation historiques ne sont pas requalifiés par ce lot.
