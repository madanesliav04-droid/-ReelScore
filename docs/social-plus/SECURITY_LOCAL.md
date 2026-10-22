# Sécurité de la V1 locale Social+

Ce backend isolé ne modifie pas le projet Supabase, le gateway de connexion Next.js, ni le worker Railway existants. Leur réutilisation distante nécessite les paramètres et l’autorisation de staging appropriés. Aucun appel réseau, envoi de mail ou service facturé n’est effectué par ce module.

## Initialiser le propriétaire

Depuis `apps/socialplus`, avec Node.js 24 :

```powershell
node scripts/provision-owner.mjs --init
node --env-file=.env.local server/index.mjs
```

La première commande crée uniquement les paramètres locaux manquants dans `.env.local`, inscrit le propriétaire dans `.data/socialplus.sqlite`, propose un URI TOTP à ajouter dans votre application d’authentification et exige un code MFA valide. Le mot de passe est demandé sans écho. Conserver le fichier `.env.local` hors Git, sauvegardé dans un emplacement privé. La clé TOTP donne accès au second facteur : ne jamais l’inclure dans un rapport, une capture ou une pull request.

Un seul identifiant propriétaire vient de `SOCIALPLUS_OWNER_ID` côté serveur. Aucun rôle envoyé par le navigateur n’est accepté. Une connexion propriétaire exige le mot de passe et un code TOTP neuf ; les codes déjà utilisés sont refusés, y compris lors de requêtes concurrentes. Sans configuration MFA, l’accès propriétaire échoue.

## Invitations et adresses vérifiées

La V1 locale ne dispose d’aucun prestataire d’e-mail. Le propriétaire doit vérifier personnellement l’adresse du destinataire, cocher l’attestation correspondante, puis transmettre le code par un canal privé au destinataire. Ce mode est une **vérification manuelle attestée par le propriétaire**, sans prétendre à une vérification automatique par e-mail.

Un code ciblé autorise uniquement l’adresse définie. Un code non ciblé ne crée pas de compte à partir d’une adresse déclarée sans vérification ; il accorde un accès à un compte déjà vérifié, après authentification par mot de passe. Le code brut n’est montré qu’une seule fois et seule son empreinte SHA-256 est conservée. Durée du code et durée de l’accès sont distinctes. Les accès durent exactement 7 ou 30 jours à partir de l’activation, ou n’expirent pas. Quota et activation sont transactionnels. Répéter l’activation d’un même code pour le même membre rend le même accès, sans prolongation ni consommation supplémentaire.

Un nouveau code permet de renouveler un compte expiré avec son mot de passe actuel. Un compte suspendu ne peut pas contourner la suspension avec une invitation. Le propriétaire peut émettre un code de récupération de mot de passe à usage unique, valable une heure ; il doit également le transmettre personnellement à l’adresse vérifiée. Le serveur n’envoie aucun message automatiquement.

## Sessions et données

Les mots de passe utilisent scrypt avec sel aléatoire et paramètres mémoire explicites. Les jetons de session aléatoires sont stockés sous forme d’empreinte et expirent après 24 heures. Les cookies sont `HttpOnly` et `SameSite=Strict` ; HTTPS impose aussi `Secure` et le préfixe `__Host-`. HTTP n’est permis que pour les adresses de boucle locale. Chaque écriture protégée vérifie l’origine et le jeton CSRF lié à la session. La révocation et les échéances sont revérifiées à chaque requête.

Les membres ne peuvent lire que leurs propres retours. Les écrans administratifs listent les métadonnées nécessaires à la gestion, sans lire leurs vidéos, diagnostics ou performances. Les actions sensibles sont journalisées sans mot de passe, code d’invitation, jeton ou contenu de rush. Les tentatives d’imposer un rôle par la requête sont ignorées et journalisées.

Les avis restent privés. Un consentement éventuel est distinct, horodaté et révocable ; aucun endpoint de publication publique d’avis n’est implémenté dans cette V1. Les réponses de FAQ sont enregistrées comme texte et ne deviennent publiques qu’après publication explicite par le propriétaire.

## Export, suppression et limites

`GET /api/privacy/export` assemble les seules données du membre connecté avec les hooks projets et Stratégie du serveur principal. L’export exclut mots de passe, jetons et secrets MFA. La suppression directe exige un nouveau contrôle du mot de passe et la confirmation `SUPPRIMER`, puis efface les fichiers, données métier, compte et sessions. Elle échoue explicitement si le serveur ne fournit pas de hook de purge complet. Une demande de suppression peut aussi être déposée et traitée par le propriétaire avec le même hook.

Le compte propriétaire se gère depuis le serveur, afin qu’aucun membre ni bouton ne puisse le supprimer ou en créer un autre. Les sauvegardes hors ligne et les informations légales réelles de l’éditeur doivent être gérées et complétées avant l’ouverture aux équipes. Cette réalisation ne prétend pas avoir reçu un audit de sécurité externe ni avoir été déployée en production.

Tests exécutables : `node server/security.test.mjs`. Les adresses `example.test`, mots de passe de fixture et la clé publique RFC 6238 présents dans ces tests ne sont jamais des identifiants d’utilisateurs réels.
