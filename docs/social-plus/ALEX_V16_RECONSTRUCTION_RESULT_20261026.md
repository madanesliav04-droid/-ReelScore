# Alex V16 — reconstruction limitée aux trois infographies

Nouveau code, pas du code V11 retrouvé. Aucune modification des modules Alex
historiques, des cinq autres moteurs ou de l’interface. Aucun service activé.

## Vidéo réellement produite

- MP4 complet : 40,5 s, 910×512 natif, 30 fps, 1 215 images, H.264/yuv420p/faststart.
- 685 images graphiques régénérées dans les trois intervalles mesurés :
  [207,389), [550,767), [807,1093) à 30 fps.
- Une seule piste AAC, bitstream identique au master ; SHA-256 audio :
  `18b9a20794cc43c9452af08ecc5e7224e56e5ea5062d932985e9b1487475daa8`.
- Décodage FFmpeg intégral exécuté, succès.
- Export : 6001956 octets ; SHA-256 `8e9f21c4dd7e416ba04db8f400aa6431533486aef19f84c169c40c4dc92c7866`.
- Temps mural observé : 15.02 s. Maximum RSS enfant :
  178344 Kio (~174.2 Mio), mesure Linux locale,
  sans extrapolation de coût cloud ou de débit multiutilisateur.

**Portée exacte :** reconstruction sur le master déjà monté. Les prises filmées,
les cuts, raccords, audio et sous-titres existants sont conservés. Dans les scènes,
la bande de sous-titres basse de 72 pixels est conservée ; le champ graphique de
440 pixels est redessiné à partir de primitives, sans images du master. Ce test
ne démontre PAS le montage automatique d’un nouveau rush, ni sa transcription.
Le modèle n’est pas réactivé dans le sélecteur web.

## Comparaison exécutée et corrections

Comparaison des 1 215 images, dont les 685 images graphiques ; images côte à côte
à 10, 22 et 32 secondes inspectées. Une vidéo comparative complète permet de
revoir les mouvements. Le plan de référence reste privé et lié au SHA du master.

Corrections fondées sur les images : positions et accents des titres/nœuds,
graisses et tailles, contours des cercles, géométrie des bandeaux, suppression du
fondu inventé, glissement des deux premiers bandeaux, apparition directe du
troisième, activations de nœuds et progression des flèches mesurées. Les six cuts
validés du master n’ont pas été recalculés.

| Scène | Erreur RGB moyenne, premier essai | Export corrigé | IoU encre sombre corrigée | IoU encre bleue corrigée |
|---|---:|---:|---:|---:|
| question | 4.014/255 | 3.437/255 | 0.593 | 0.413 |
| value | 5.501/255 | 4.123/255 | 0.599 | 0.526 |
| chain | 4.502/255 | 3.544/255 | 0.703 | 0.496 |

Ces erreurs et intersections de masques ne sont pas une note commerciale.
L’IoU de premier plan expose les différences de glyphes/placements au lieu de
masquer celles-ci par le grand fond clair. L’export n’est pas identique au master.
Le réencodage des séquences filmées induit aussi une erreur RGB moyenne de
1.522/255.

Limites encore visibles : métriques de la variante Inter historique non récupérée,
anti-aliasing, couleurs/traits et détails de mouvement résiduels. Les fontes
embarquées sont des variantes libres déjà présentes dans Social+, pas une preuve
de récupération des fichiers typographiques d’origine. Pas de score 100/100,
pas de validation sonore/phonétique ni d’iPhone physique revendiqués.

## Tests

11 tests Python ciblés réussis sur la version finale : mots non confirmés,
transfert interdit des timings historiques à un nouveau rush, chevauchements,
paramètres d’animation invalides, débordements, déterminisme, dimensions natives
et empreintes des fontes. Contrôles codec/durée/pistes/décodage et identité AAC
exécutés sur le véritable MP4. Les empreintes des quatre modules Alex restaurés
sont inchangées. Les 19 tests navigateur de la PR ont déjà réussi sur GitHub ;
aucun frontend n’a été modifié depuis. Les 59 tests worker n’ont pas été relancés
inutilement : aucun de leurs fichiers ni code couvert n’a changé.

## Cloudflare et conservation

Le défaut local d’entrée manquante depuis la racine est reproduit et corrigé par
`wrangler.jsonc`, nommé `reelscore-preview`, sans route/cron de production.
`wrangler 4.153.0 deploy --dry-run` réussit depuis la racine. L’ancien Worker
`viral-plus-api` reste inchangé. Cette vérification ne déploie rien.

Le journal du build distant `ffca36a0-526b-494b-9827-54828bab31aa` est inaccessible
sans session Cloudflare autorisée ; GitHub ne fournit ni log ni annotation.
L’erreur distante n’est donc ni précisément confirmée ni corrigée à distance.
Le propriétaire doit fournir le journal et isoler l’intégration de preview du
hook visant `reelscore/production`, avant toute mise à jour déclenchant un build.

Code sauvegardé localement et comme commit GitHub sans mise à jour de référence,
pour permettre sa revue sans déclencher le hook de production. La branche de la
PR #58, ses six modèles et la production ne sont pas activés/modifiés par ce
stockage. Aucun média ni plan personnel dans le commit public. Les vidéos, plans
et mesures détaillées sont livrés uniquement via les fichiers privés de tâche.

## Verdict

Export de reconstruction de référence vérifié techniquement et comparable.
**Pas encore un Alex V16 autonome prêt à publier sur un nouveau rush.** Il reste
à approuver la fidélité, résoudre les écarts restants, puis raccorder les scènes à
un vrai plan de cuts/transcription vérifié du pipeline existant, sans falsifier
les indicateurs de mots confirmés. Aucun montage générique n’a été substitué.
