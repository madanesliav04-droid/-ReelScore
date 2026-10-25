# Bêta privée gratuite — 30 jours

La commercialisation est différée. Aucun abonnement, Stripe, tarif ou code promotionnel n’est développé. Les six moteurs et leur statut bêta sont conservés.

## Accès et limites

Le système d’invitations existant accorde 30 jours **à partir de l’activation de chaque accès** ; cette durée est désormais présélectionnée dans l’administration. Les durées antérieures 7 jours et permanente restent disponibles au propriétaire pour ne pas supprimer les fonctions validées. La campagne n’est pas annoncée ouverte : le serveur fonctionnel n’est pas encore accessible à des testeurs distants.

Limites conservées : 200 Mo par import, 1 Go logique par membre, 10 traitements/jour UTC par membre, un traitement serveur à la fois, rushs jusqu’à 60 secondes et 1080p pour les adaptateurs de modèles. La reprise d’un rendu interrompu est bornée. Ces quotas n’établissent pas un coût nul de machine ou d’hébergement.

## Retours réellement enregistrés par le serveur

Le formulaire existant propose note facultative sur 5, catégorie avis/bug/idée/support, expérience générale/montage/analyse, satisfaction oui/en partie/non, message et témoignage facultatif. Le consentement de publication reste distinct, non coché et révocable. Sans consentement, le témoignage reste privé ; même avec consentement, aucune publication automatique n’est ajoutée.

Les nouveaux champs restent accessibles seulement à l’auteur et à l’administration propriétaire. Ils suivent l’export et la suppression des données. Les contrôles d’autorisation, CSRF et limitation des abus sont conservés.

## Tableau administrateur

`GET /api/admin/beta` est réservé au propriétaire avec MFA. Il affiche :

- testeurs inscrits, propriétaire exclu ;
- actifs sur 7 jours, observés à travers une journée UTC d’activité authentifiée ;
- retour d’usage : membres présents sur au moins deux jours distincts / membres actifs sur la fenêtre de 30 jours ;
- vidéos importées actuellement conservées, tâches terminées/échouées encore conservées et rapports acoustiques conservés ;
- moyenne et total des durées murales mesurées, sans conversion en CPU facturé ;
- notes et moyenne seulement si des notes existent ;
- participation aux avis : auteurs distincts / testeurs inscrits ;
- agrégation de satisfaction par expérience.

Les snapshots de médias/rapports ne prétendent pas compter tous les imports ou recalculs historiques. Supprimer un compte ou un projet retire les données concernées des agrégats. Les mesures antérieures non collectées ne sont jamais reconstituées.

Seule une ligne membre/jour est ajoutée pour l’activité : aucun nouvel identifiant d’appareil, adresse IP, journal de navigation détaillé ou outil tiers. La purge de la fenêtre de 30 jours s’exécute à la prochaine activité ou consultation. La suppression du membre efface ces journées par clé étrangère. Les données d’activité personnelles sont incluses dans l’export.

## Aperçu Vercel et périmètre

Voir `apps/socialplus/preview/README.md` : aperçu statique isolé, réactivé après accord explicite du propriétaire le 25 octobre malgré la classification initiale production par Vercel. URL privée vérifiée : https://socialplus-beta-interface-dmaf8mkut-dceo.vercel.app . Le second envoi de staging reste BLOCKED et n’est pas utilisé. Cet aperçu ne doit pas être présenté comme une bêta de montage/analyse active. Les améliorations serveur ci-dessus ne sont pas déployées sur cet aperçu statique.

Avant l’ouverture de la bêta fonctionnelle : hébergement privé compatible, recette Safari matériel et informations juridiques réelles restent nécessaires. Aucun serveur payant n’est activé.
