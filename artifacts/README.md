# Preuves locales Social+ V18

Ces preuves utilisent uniquement des comptes temporaires, des métriques de test identifiées et des vidéos synthétiques générées (couleur et tonalité). Aucun contenu privé réel n’est publié. Le démarrage normal de Social+ ne charge aucune de ces données.

## Interface exécutée

Chromium Linux : PC 1440 × 1000, téléphone 390 × 844 et rotation 844 × 390. Il ne s’agit pas de Safari sur iPhone physique, ni de Chrome Windows. Les douze captures suivent un vrai parcours MFA → profil/CSV → enregistrement vidéo → conversion MP4/téléchargement → invitation propriétaire → activation membre et refus de sa route ADMIN.

- [Accueil PC](browser/desktop-home.png)
- [Montage et téléchargement PC](browser/desktop-export.png)
- [Stratégie PC](browser/desktop-strategy.png)
- [Performances et graphique comparable](browser/desktop-metrics.png)
- [Administration propriétaire](browser/desktop-admin.png)
- [Accueil au format iPhone](browser/mobile-home.png)
- [Montage au format iPhone](browser/mobile-montage.png)
- [Stratégie au format iPhone](browser/mobile-strategy.png)
- [Mode clair](browser/mobile-light.png)
- [Rotation mobile](browser/mobile-landscape.png)
- [Résultat navigateur et SHA du téléchargement](browser/smoke-report.json)

Le parcours navigateur a été réexécuté avec succès après les correctifs de session et l’ajout de la FAQ initiale. Révocation et changement de compte dans le même navigateur sont vérifiés. Les captures ne sont pas présentées comme un essai sur matériel Apple.

## Rendus exécutés

- [MP4 téléchargé dans le navigateur](browser/browser-technical-export.mp4) : H.264/AAC, une piste audio, 640 × 360, environ trois secondes ; [preuve FFprobe](browser/download-probe.json).
- [Journal des trois conversions et overlay Alex](render/report.json) : SHA-256, dimensions, codecs, tailles et durée murale.
- [Overlay Alex de grammaire OMNI en laboratoire](render/alex-reference-grammar-synthetic.mp4) et [image effectivement rendue](render/alex-reference-grammar-frame.png).

Ces rendus vérifient l’exécution de FFmpeg et d’un renderer ASS hérité. Ils ne constituent pas une certification des références artistiques V16/V28/V53/V60/V7 et ne contiennent aucune parole réelle. Les sources et les trois nouveaux rushs par modèle restent indispensables.

## Tests

- [68 tests du serveur](v18-local-tests.log), aucun échec.
- [17 tests des moteurs hérités](inherited-engine-tests.log), aucun échec.
- [97 scénarios d’acceptation et leurs limites](../docs/social-plus/V18_ACCEPTANCE_REPORT.md).

Les nombres de tests unitaires/intégration ne sont pas le nombre de scénarios V18 réussis. Aucun staging distant, service facturé ou déploiement de production n’a été déclenché.
