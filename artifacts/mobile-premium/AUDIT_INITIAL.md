# Audit préalable — Social+ mobile

État de départ : branche Windows/iPhone, application existante conservée. Aucun framework React, Vue, SwiftUI ou Capacitor : HTML, CSS et modules JavaScript natifs. Serveur HTTP Node 24, SQLite synchrone, sessions HttpOnly, MFA propriétaire, contrôles d’origine/CSRF et cloisonnement par membre. Deux dépendances npm : GSAP 3.13 et Playwright Core 1.57, utilisées par le compositeur Kinetic et les tests. Python/Pillow/numpy, FFmpeg/libass et Whisper local assurent le traitement. Les polices autorisées sont embarquées.

Lecture des points d’entrée frontend, styles, navigation, gestionnaires, API, persistance des projets, sécurité, analyse acoustique/éditoriale, transcription, renderer, planificateurs et composants de modèles ; inventaire complémentaire des fichiers et empreintes dans `source-inventory.json`. Les scripts Windows/HTTPS, tests et comptes existants sont conservés. Les archives historiques et bibliothèques ne sont pas réécrites.

## Fonctionnel à conserver

- Import privé 200 Mo, FFprobe, formats natifs et sélection de la première piste audio originale.
- Six ports bêta raccordés, Cinematic avec planificateur autonome et signalement des mots incertains.
- Tâches de rendu SQLite, progression issue du renderer, reprise d’affichage via latestJob ; arrêt serveur détecté comme échec explicite.
- Analyse FFmpeg déterministe, cache SHA-256/version ; revue éditoriale manuelle documentée, couverture minimale avant score global.
- Administration/MFA, FAQ, avis privés, support, confidentialité et gestion des données.

## Défauts observés

- Deux onglets seulement ; Accueil masqué et aucun espace Projets autonome.
- JSON de transcription et d’événements au premier niveau ; sauvegarde manuelle avant préparation ; trop de formulaires et doubles actions.
- Import Montage non réutilisé directement dans Analyse ; aperçu Analyse perdu à la navigation.
- Sélection d’un nouveau modèle sans recalcul des événements du précédent.
- Polling lié à l’écran courant et au projet mutable, susceptible d’afficher un résultat périmé après navigation ; absence de récupération visible après perte réseau.
- Extraits vidéo chargés pour tous les projets ; surfaces trop grandes sur iPhone, inputs sous 16 px (zoom Safari), safe-area haute absente.
- Pas de partage natif de fichier ni de différenciation entre téléchargement et partage.

## Décisions

Conserver les modules natifs et les moteurs. Extraire les utilitaires communs d’interface, rapprocher import et sauvegarde, conserver le même projet entre vues, offrir une revue lisible et garder le JSON en outils avancés. Rétablir quatre espaces tactiles et des listes compactes. Capturer l’identité du projet/écran pour le polling, restaurer le projet courant sans conserver de média dans le stockage navigateur. Aucun cache hors ligne des données privées.

Capacitor est un candidat cohérent pour réemployer cette interface, après validation Safari et séparation explicite de l’adaptateur réseau. Il ne déplacera pas Python/FFmpeg/Whisper sur l’iPhone. Pas de migration native ni de dépendance Capacitor dans cette passe. Une future coque exige traitement serveur HTTPS durable, stockage privé, politique d’origines native stricte, transferts arrière-plan et permissions limitées ; l’installation Wi-Fi actuelle n’est pas une architecture de production App Store.
