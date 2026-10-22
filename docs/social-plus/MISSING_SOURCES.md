# Éléments indispensables à la finalisation des moteurs

Le pack léger reçu le 22 octobre contient les scripts Codie V60, Leila V53/V51/V46, Spatial V8/V9/V10 et Cinematic V7, avec timings et réglages V7. Ils sont conservés intacts dans `apps/socialplus/engines/originals/`, avec SHA-256. Les médias listés par le manifeste complet ne sont pas inclus dans ce ZIP léger.

| Modèle | Médias ou dépendances encore nécessaires | Raccord disponible |
|---|---|---|
| Codie × OMNI V60 | `EDITPLUS_V60_FINITION_PACK_QA.zip` complet et `EDITPLUS_V60_FINITION_OMNI.mp4` ; le script désigne `IMG_0506.mp4`, `MX-18296.mp4`, `MX-241.mp4`, le MP4 V59 audio et les captions V57 | Icônes originales portées sur mots alignés et placement revu ; MP4 de composants testable, recette V60 complète en attente |
| Alex Hormozi V16 | `EDITPLUS_HORMOZI_V16_RETOUR_V11_PACK.zip`, master/rush/assets | Directeur, beats et renderer OMNI existants conservés |
| Leila V53 | `IMG_0516.mp4`, `EDITPLUS_LEILA_IMG_0516_V44_MUR_ANCRE_PREMIUM.mp4`, `EDITPLUS_LEILA_IMG_0516_V49_RETOUCHES_FINALES_IPHONE.mp4`, master V53 | Dessin mural original réutilisé sur les titres parlés du nouveau rush ; chaîne V53 historique dépend encore des pixels V44 et de l’audio V49 |
| Social Kinetic V28 | Master/rush de référence, runtime Hyperframes local et preuves de placement/alignement | Moteur et runtime V28 existants conservés |
| Spatial UI V10 | `MODELE05_V10_SAUVEGARDE_COMPLETE.zip` complet ; rush, médias V8/V9 et master V10 | Composant titre original V10 porté ; chaîne V10 complète dépend encore des rendus V8/V9 |
| Cinematic V7 | `CINEMATIC_STORYTELLING_V7_PROJET_COMPLET.zip` avec `media/IMG_0506(2).mp4` et `media/IMG_0506_CINEMATIC_V6_APPLE_MINIMAL_IPHONE.mp4` ; master `IMG_0506_CINEMATIC_V7_PREMIUM_FINAL_IPHONE.mp4` | Script Python original, configuration et timings récupérés. La V7 utilise les images et l’audio de V6 pour ses scènes ; aucune scène de remplacement n’est fabriquée |

Les essais Codie/Leila/Spatial utilisent les fonctions graphiques originales et de nouveaux textes/timings fournis, sans exécuter les anciens cuts ni réutiliser l’audio d’une autre vidéo. Ils restent des prévisualisations des composants, distinctes des masters artistiques complets. Les polices système de substitution sont signalées. Les titres Leila sont ajustés à leur zone pour éviter leur troncature.

Il faut également au moins trois nouveaux rushs de parole autorisés par modèle, distincts de leurs rushs de conception, pour les recettes de fidélité, synchronisation, son et composition. Les fixtures techniques couleurs/tonalité fournissent des preuves d’exécution FFmpeg, pas une certification artistique.

Le pack contenant la maquette Apple Pro validée n’est pas présent dans les éléments récupérés. L’interface développée est réelle et testée, mais aucune comparaison pixel à pixel avec ce pack absent n’est revendiquée.

Les informations juridiques réelles (éditeur, adresse, contact, hébergeur, conservation et sous-traitants) doivent être renseignées et validées par le propriétaire avant l’ouverture aux équipes. Aucun nom ou contact fictif n’a été inventé.

Une recette Safari sur iPhone physique et Chrome sur Windows reste nécessaire. Les captures existantes sont produites par Chromium Linux, dont des dimensions iPhone, les modes clair/sombre et une rotation émulée. Aucun hébergement HTTPS distant gratuit existant n’a été établi pour cette branche ; aucun service supplémentaire n’est activé.

La branche déployée et les coûts actuels de Supabase/Railway/Cloudflare ne sont pas certifiés par cette livraison locale : aucun identifiant d’infrastructure n’est configuré dans cet environnement. Les services existants ne sont ni migrés ni modifiés. Le workflow Pages du dépôt ne déploie automatiquement que `main`, qui n’a pas été modifiée.
