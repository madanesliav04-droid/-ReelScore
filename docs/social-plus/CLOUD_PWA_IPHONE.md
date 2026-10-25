# Social+ sans PC — choix cloud et PWA

## Solution retenue, non activée

Une **instance de test distincte dans Railway `viral-edit`** héberge le code Social+ existant : interface, API authentifiée et worker asynchrone. Une seule origine HTTPS stable permet l’installation PWA et évite les cookies tiers Safari. Vercel peut rester inchangé ; la PWA s’installe depuis l’URL du serveur complet. Le PC peut être éteint.

Le conteneur conserve Node 24, FFmpeg, Chromium, Python et le compositeur V28 verrouillé. `deploy/Dockerfile.cloud-preview` prépare le Python ASR, télécharge les poids publics Whisper pendant le build autorisé et contrôle leur SHA-256. Aucun appel Gemini/Stripe, aucune clé d’API de transcription payante. Le volume `/data` conserve SQLite, rushs et exports après redémarrage ; les poids restent dans l’image. Les anciennes ressources de production ne sont ni modifiées ni réaffectées.

Le manifeste, les icônes et le service worker sont ajoutés sans changer la mise en page. Aucun cache PWA de compte, transcription, API, rush ou MP4. Sans réseau, la PWA explique que le serveur est nécessaire ; elle ne simule pas des projets ou traitements hors ligne. Sur iPhone : ouvrir l’URL complète dans Safari → Partager → Sur l’écran d’accueil. L’installation physique et les comportements Safari restent à tester.

## Comparaison tarifaire vérifiée le 25 octobre 2026

| Solution | Tarif officiel / condition | Conclusion pour ce premier test |
| --- | --- | --- |
| Railway existant | Free : 1 $ de crédit/mois, 512 Mo/service. Hobby : 5 $/mois minimum, incluant 5 $ de ressources ; surplus facturé. | Le plus court avec l’infrastructure existante. Free non validé pour Whisper + Chromium. Le forfait et les crédits actuels ne sont pas accessibles aux outils : surcoût nul non démontré. |
| Render | Gratuit : 512 Mo, veille et disque éphémère. 2 Go : 25 $/mois, disque persistant en supplément. | Le gratuit ne conserve pas la SQLite et les fichiers de façon fiable ; l’offre 2 Go coûte davantage. |
| Hugging Face Spaces | CPU Basic sans coût horaire, mais la documentation actuelle exige un forfait payant pour créer un Docker Space ; disque par défaut non persistant. | Ne pas présenter comme backend privé durable à 0 $. Il faudrait également adapter la persistance. |
| Oracle Always Free | Certaines VM et volumes peuvent être gratuits dans les quotas Always Free. Capacité disponible non garantie ; instances inactives susceptibles d’être récupérées. | Seule piste potentiellement à 0 $ avec VM persistante, mais aucun compte/instance disponible n’est confirmé ici. Plus de configuration système, HTTPS et exploitation ; aucune compatibilité ARM validée par ce travail. |
| Vercel seul | L’aperçu existant est statique ; le serveur actuel utilise SQLite, médias persistants et tâches en arrière-plan. | Un conteneur/une fonction Vercel ne suffit pas à préserver ce serveur inchangé. Il faudrait externaliser les données et adapter l’orchestration, donc davantage de changements. |

Sources :

- https://docs.railway.com/pricing/plans
- https://render.com/pricing et https://render.com/docs/free
- https://huggingface.co/docs/hub/spaces-overview
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## Ce que coûte réellement la solution

Les tarifs Railway connus sont 10 $/Go-mois de RAM utilisée, 20 $/vCPU-mois utilisé, 0,15 $/Go-mois de volume et 0,05 $/Go sortant. La souscription Hobby impose un minimum de 5 $/mois ; elle ne s’ajoute pas intégralement à une consommation déjà incluse. Réutiliser le même compte ne crée pas forcément une seconde souscription, mais ajoute une consommation facturable.

**Exemple budgétaire, pas facture mesurée** : 0,5 Go de RAM au repos ≈ 5 $/mois ; 5 Go de volume ≈ 0,75 $/mois ; 10 Go de trafic sortant ≈ 0,50 $. Soixante calculs de 40 secondes à 2 vCPU et 2 Go de RAM totale pendant le calcul ajoutent environ 0,051 $. Total indicatif ≈ 6,30 $ de ressources, hors consommation existante, taxes et conversion. Le temps de 40 secondes et les ressources sont une hypothèse de budget ; les vrais coûts cloud doivent être mesurés après le premier rendu. La mémoire et le ralentissement éventuel peuvent augmenter ce total.

Prévoir **5 à 15 $/mois à titre provisoire**, sans garantie de plafond. La facture du compte, ses crédits et ses autres services sont inconnus ici. Aucun prix exact par utilisateur ou rendu cloud n’est certifié. Il n’existe pas d’autorisation de frais supplémentaires dans cette mission.

## Activation la plus courte après accord

1. Vérifier le forfait, le crédit restant et les limites de dépenses dans Railway Usage/Billing. Ne pas imposer un plafond global qui interromprait les services de production existants.
2. Autoriser l’environnement/service de test isolé et son budget. Configurer explicitement `deploy/railway-cloud-preview.toml`, depuis la racine du dépôt ; ne pas changer les services actuels.
3. Prévoir un seul worker et tester d’abord une enveloppe de 2 Go RAM/2 vCPU, ajustée aux mesures. Monter `/data` sur un volume persistant. Configurer `NODE_ENV=production`, `SOCIALPLUS_HOST=0.0.0.0`, `SOCIALPLUS_DATA_DIR=/data`, `SOCIALPLUS_MAX_RENDERS_PER_DAY=6`. Analyse, transcription et rendu comptent comme traitements distincts : une première préparation complète en utilise trois.
4. Configurer l’origine HTTPS exacte et les paramètres propriétaires dans les secrets serveur. Provisionner le compte via le CLI propriétaire existant dans une session privée ; ne pas déposer le mot de passe/MFA dans Git ou dans cette conversation. Aucun secret dans Vercel ou le manifeste PWA.
5. Construire l’image, vérifier le modèle, l’intégrité V28, les sessions et le stockage. L’image est préparée mais **n’a pas été construite ni exécutée dans Railway** par cette mission.
6. Effectuer un vrai import et rendu, contrôler lecture, téléchargement Range et réouverture après redémarrage. Mesurer les ressources et l’usage facturable. Fournir l’URL stable pour la recette Safari et l’installation sur l’écran d’accueil, PC éteint.

Le rush déjà validé possède une direction contextuelle liée à son fichier et à sa transcription exacts. **Une autre vidéo exige encore sa propre direction** ; ce changement d’hébergement n’ajoute pas d’analyse éditoriale automatique et ne doit pas appliquer les anciens timings à un nouveau rush.

## État vérifiable

Test PWA réussi dans Chromium mobile sur une origine locale sécurisée au sens du navigateur : manifeste, icônes, service worker, message hors ligne, absence de caches privés, retour en ligne. Les modules V28 verrouillés et les cinq autres moteurs sont inchangés. Aucun déploiement, abonnement, ressource cloud, mise à jour de production ou PR existante modifiée. Safari physique et le parcours cloud restent non exécutés.
